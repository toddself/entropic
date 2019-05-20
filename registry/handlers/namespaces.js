'use strict';

const isNamespaceMember = require('../decorators/is-namespace-member');
const NamespaceMember = require('../models/namespace-member');
const isLoggedIn = require('../decorators/is-logged-in');
const Namespace = require('../models/namespace');
const Package = require('../models/package');
const response = require('../lib/response');
const User = require('../models/user');
const fork = require('../lib/router');

module.exports = [
  fork.get('/namespaces', namespaces),
  fork.get('/namespaces/namespace/:namespace([^@]+)@:host/members', members),
  fork.post(
    '/namespaces/namespace/:namespace([^@]+)@:host/members/:invitee',
    findUser(canChangeNamespace(invite))
  ),
  fork.del(
    '/namespaces/namespace/:namespace([^@]+)@:host/members/:invitee',
    findUser(canChangeNamespace(remove))
  ),
  fork.post(
    '/namespaces/namespace/:namespace([^@]+)@:host/members/invitation',
    findNamespace(accept)
  ),
  fork.del(
    '/namespaces/namespace/:namespace([^@]+)@:host/members/invitation',
    findNamespace(decline)
  ),
  // these two probably belong in a users path space
  fork.get(
    '/namespaces/namespace/:namespace([^@]+)@:host/memberships/pending',
    isLoggedIn(pendingMemberships)
  ),
  fork.get(
    '/namespaces/namespace/:namespace([^@]+)@:host/memberships',
    memberships
  ),
  fork.get(
    '/namespaces/namespace/:namespace([^@]+)@:host/maintainerships/pending',
    isLoggedIn(canChangeNamespace(pendingMaintainerships))
  ),
  fork.get(
    '/namespaces/namespace/:namespace([^@]+)@:host/maintainerships',
    findNamespace(maintainerships)
  )
];

function findUser(next) {
  return async (context, params) => {
    const user = await User.objects
      .get({
        active: true,
        name: params.invitee
      })
      .catch(User.objects.NotFound, () => null);

    context.invitee = user;
    return next(context, params);
  };
}

function findNamespace(next) {
  return async (context, params) => {
    const ns = await Namespace.objects
      .get({
        active: true,
        name: params.namespace,
        'host.name': params.host
      })
      .catch(Namespace.objects.NotFound, () => null);

    context.namespace = ns;
    return next(context, params);
  };
}

// This is identical to isNameSpaceMember except for the parameters read.
// This one pays attention to the host.
function canChangeNamespace(next) {
  return async (context, params) => {
    if (!context.user) {
      return response.error(
        'You must be logged in to perform this action',
        403
      );
    }

    const ns = await Namespace.objects
      .get({
        active: true,
        name: params.namespace,
        'host.name': params.host,
        'namespace_members.active': true,
        'namespace_members.user_id': context.user.id
      })
      .catch(Namespace.objects.NotFound, () => null);

    if (!ns) {
      return response.error(
        `You cannot act on behalf of ${params.namespace}@${params.host}`,
        403
      );
    }

    context.namespace = ns;
    return next(context, params);
  };
}

async function namespaces(context, params) {
  const namespaces = await Namespace.objects
    .filter({
      active: true
    })
    .values('name')
    .then();
  const objects = namespaces.map(ns => ns.name).sort();
  return response.json({ objects });
}

async function members(context, { namespace, host }) {
  const ns = await Namespace.objects
    .get({
      active: true,
      name: namespace,
      'host.name': host
    })
    .catch(Namespace.objects.NotFound, () => null);

  if (!ns) {
    return response.error(`${namespace}@${host} does not exist.`, 404);
  }

  const users = await User.objects
    .filter({
      'namespace_members.namespace_id': ns.id,
      'namespace_members.active': true
    })
    .then();

  const objects = namespaces.map(users => users.name).sort();
  return response.json({ objects });
}

async function invite(context, { invitee, namespace, host }) {
  if (!context.invitee) {
    return response.error(`${invitee} not found.`, 404);
  }

  const existing = await NamespaceMember.objects
    .get({ user: context.invitee, namespace: context.namespace })
    .catch(NamespaceMember.objects.NotFound, () => null);
  if (existing) {
    let msg;
    if (existing.active) {
      msg = `${invitee} is already a member of ${namespace}@${host}.`;
    } else {
      msg = `${invitee} has already been invited to join ${namespace}@${host}.`;
    }
    return response.message(msg);
  }

  await NamespaceMember.objects.create({
    namespace: context.namespace,
    user: context.invitee,
    accepted: false,
    active: false
  });

  context.logger.info(
    `${invitee} invited to join ${namespace}@${host} by ${context.user.name}`
  );
  return response.message(`${invitee} invited to join ${namespace}@${host}.`);
}

async function remove(context, { invitee, namespace, host }) {
  if (!context.invitee) {
    return response.error(`${invitee} does not exist.`, 404);
  }

  const membership = await NamespaceMember.objects
    .filter({
      user_id: context.invitee.id,
      namespace_id: context.namespace.id,
      active: true
    })
    .slice(0, 1)
    .update({
      modified: new Date(),
      active: false
    })
    .then();

  if (membership.length === 0) {
    return response.message(
      `${invitee} was not a member of ${namespace}@${host}.`
    );
  }
  context.logger.info(
    `${invitee} removed from ${namespace}@${host} by ${context.user.name}`
  );

  return response.message(`${invitee} removed from ${namespace}@${host}.`);
}

async function accept(context, {}) {
  const invitation = await NamespaceMember.objects
    .filter({
      namespace_id: context.namespace.id,
      user_id: context.user.id
    })
    .update({
      active: true,
      accepted: true
    })
    .catch(NamespaceMember.objects.NotFound, () => null);

  if (!invitation) {
    return response.error('invitation not found', 404);
  }

  context.logger.info(
    `${context.user.name} accepted the invitation to join ${namespace}@${host}`
  );
  return response.message(
    `${context.user.name} is now a member of ${namespace}@${host}`
  );
}

async function decline(context, {}) {}

async function pendingMemberships(context, params) {
  const memberships = await Namespace.objects
    .filter({
      'namespace_members.accepted': false,
      'namespace_members.active': false,
      'namespace_members.user_id': context.user.id,
      active: true
    })
    .then();

  const objects = [];
  for (const ns of memberships) {
    objects.push(ns);
  }

  return response.json({ objects });
}

async function memberships(context, params) {
  const user = await User.objects
    .get({
      active: true,
      name: params.namespace
    })
    .catch(User.objects.NotFound, () => null);

  if (!user) {
    return response.error(`${name}@${host} not found`, 404);
  }

  const memberships = await Namespace.objects
    .filter({
      'namespace_members.user_id': user.id,
      active: true
    })
    .values('name')
    .then();

  const objects = [];
  for (const ns of memberships) {
    objects.push(ns);
  }

  return response.json({ objects });
}

async function pendingMaintainerships(context, params) {
  const pkgInvitations = await Package.objects
    .filter({
      'maintainers.accepted': false,
      'maintainers.active': false,
      'maintainers.namespace_id': context.namespace.id,
      active: true,
      'namespace.active': true,
      'namespace.host.active': true
    })
    .then();

  const objects = [];
  for (const pkg of pkgInvitations) {
    objects.push(await pkg.serialize());
  }

  return response.json({ objects });
}

async function maintainerships(context, params) {
  const pkgInvitations = await Package.objects
    .filter({
      'maintainers.accepted': true,
      'maintainers.active': true,
      'maintainers.namespace_id': context.namespace.id,
      active: true,
      'namespace.active': true,
      'namespace.host.active': true
    })
    .then();

  const objects = [];
  for (const pkg of pkgInvitations) {
    objects.push(await pkg.serialize());
  }

  return response.json({ objects });
}