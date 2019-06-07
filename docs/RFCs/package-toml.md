# Package.toml format

A proposal for a more formal Package.toml definition

- Version: DRAFT
- Date: 06/06/2019
- Authors
  - Todd Kennedy <todd@selfassembled.org>

## Abstract

This document is meant to describe the package manifest format for Entropic,
a federated solution to package management. Entropic needs to have its own
manifest file due to conflicts arising from the namespacing entropic uses.

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be
interpreted as described in [RFC 2119](https://tools.ietf.org/html/rfc2119).

## Copyright

This document is copyright by its individual contributors, and available for
re-use under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

## Introduction

Entropic cannot share a manifest format with the traditional `package.json` format
associated with the ECMAScript ecosystem for a number of reasons:

1. Entropic is intended to allow for federated package management for more than just the ECMAScript ecosystem
1. The `package.json` name specifier does not allow for the namespacing that entropic provides
1. There are recognized deficiencies with using JSON as human-readable metadata format

## Filename

The filename of the manifest **MUST** be `Package.toml` and it **MUST** live in
the root directory of the package's filesystem. The root of the package is defined
as the closest parent directory that contains the manifest file, starting with
the current directory.

On case-insensitive filesystems, it **MAY** be presented as `package.toml` but care
should be taken to preserve case when possible.

## Format

The format of this file is **REQUIRED** to be in [TOML](https://github.com/toml-lang/toml)
version 0.5.0 or later as defined by the project.

### Top-Level Data

The manifest **MUST** contain the following top-level keys:

- `"name"` - the canonical name of the package, as a string, including it's namespace. e.g. `"toddself@static-pkg.dev/packge2toml"`
- `"version"` - a [SEMVER](https://semver.org/) designation conforming to version 2.0.0 of the semantic versioning specification. Due to how TOML parses numbers, this must be represented as a string. e.g. `"1.0.4"`

The manifest **MAY** contain the following fields:

- `"entry"` - the filename and package-relative path, as a string, to the main entry point of the package. The root for the relative-path is the directory which contains the `Package.toml` file. e.g `"./src/index.js"`
- `"type"` - if set to `"module"` this will output a [`package.json` with this included](https://nodejs.org/api/esm.html#esm_code_package_json_code_code_type_code_field), and will signal to the node interpreter to run this code an ES6 Module.
- `"license"` - a valid [SPDX license](https://spdx.org/licenses/) for your code
- `"description"` - a short description of your package
- `"homepage"` - a URL for your project's homepage
- `"author"` - who wrote this package
- `"repository"` - where does this code live

These fields **MAY** or **MAY NOT** be validated by CLI tools or the server-side
software, depending on the implmentation.

### Subsections

The manifest file **MAY** contain zero or more subsections as defined below.

#### Dependency Lists

Dependencies lists contain all the resources that are required for
this package, in various scenarios. The dependencies **MUST** be declared as `"key" = "value"`
pairs where the `key` is the package's canonical name (as from the top-level section
of it's `Package.toml` file) and the `value` is a valid SEMVER version or range
expression that points to a valid package.

Examples:

To specify a specific version:

```
"toddself@static-pkg.dev/package2toml" = "1.0.4"
```

To specify all versions within a given major revision:

```
"toddself@static-pkg.dev/package2toml" = "^1.0.0"
```

To specify any version

```
"toddself@static-pkg.dev/package2toml" = "*"
```

#### Dependency Types

You **MAY** declare dependency types for:

- `[dependencies]` - these are the packages that are required to run this package. They will be installed automatically when this package is required by another package, or when you specifically install the dependencies for this package manually.
- `[devDependencies]` - these are packages that are required to develop this package. They will be installed only when you install the dependencies for this package manually. If a package depends on the current package, they will **NOT** be installed as part of that dependency graph.
- `[peerDependencies]` - these packages are rqeuired to run this package, however, they will not be installed and should be additionally depended on or installed by either the parent package or along side this package for development.
- `[optionalDependencies]` - these packages are not required to run this software, but may provide additional options or features in this package. They must be required or installed by the parent package or along side this package for development.

### Example Package.toml

```toml
"name" = "todd@static-pkg.dev/package2toml"
"version" = "1.0.4"

[dependencies]
"legacy@registry.entropic.dev/minimist" = "^1.2.0"

[devDependencies]
"legacy@registry.entropic.dev/tape" = "*"
```

## Contributors

- Chris Dickinson [@chrisdickinson](https://github.com/chrisdickinson)
- CJ Silverio [@ceejbot](https://github.com/ceejbot)