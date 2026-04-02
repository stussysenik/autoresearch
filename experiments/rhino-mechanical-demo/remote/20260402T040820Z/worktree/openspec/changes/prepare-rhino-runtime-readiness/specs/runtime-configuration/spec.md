## ADDED Requirements

### Requirement: The CLI SHALL resolve runtime configuration through deterministic precedence
The system SHALL compute an effective runtime configuration from built-in defaults, `.env.local`, process environment variables, and CLI flags. The winning precedence order SHALL be built-in defaults, then dotenv values, then process environment variables, then CLI overrides.

#### Scenario: Use built-in defaults when no overrides exist
- **WHEN** the user runs a bridge-facing command without a `.env.local` file, relevant environment variables, or CLI overrides
- **THEN** the effective session id is `default`
- **THEN** the effective database path is `var/rhino-nlcli.db`
- **THEN** the effective bridge profile is `mock-rhino`
- **THEN** the effective socket path is `var/rhino.sock`

#### Scenario: CLI overrides every lower-precedence source
- **WHEN** the same runtime field is provided by `.env.local`, process environment variables, and a CLI flag
- **THEN** the CLI uses the CLI value
- **THEN** inspection output identifies that field source as `cli`

### Requirement: The CLI SHALL validate dotenv configuration before using it
The system SHALL auto-load `.env.local` when present, SHALL tolerate a missing default dotenv file, and SHALL fail fast on malformed or empty supported config values.

#### Scenario: Missing default dotenv file does not block execution
- **WHEN** `.env.local` is absent from the working directory
- **THEN** the CLI continues using defaults plus any process environment variables and CLI overrides
- **THEN** the absence is reflected as an unloaded dotenv source rather than a fatal error

#### Scenario: Malformed dotenv lines fail with location information
- **WHEN** `.env.local` contains a malformed `KEY=VALUE` line for runtime configuration
- **THEN** the CLI exits before execution
- **THEN** the error identifies the offending line number

#### Scenario: Empty supported values are rejected
- **WHEN** `.env.local` or process environment variables set `RHINO_NLCLI_DB_PATH`, `RHINO_NLCLI_SESSION`, `RHINO_NLCLI_BRIDGE_PROFILE`, or `RHINO_NLCLI_SOCKET_PATH` to an empty string
- **THEN** the CLI exits with a configuration error
- **THEN** the empty value is not treated as if the setting were missing

### Requirement: Dotenv-defined relative paths SHALL resolve from the dotenv file directory
The system SHALL resolve relative file-system paths loaded from a dotenv file against the directory containing that dotenv file.

#### Scenario: Resolve a relative database path from a custom env file location
- **WHEN** an env file at `config/dev/.env.local` contains `RHINO_NLCLI_DB_PATH=var/dev.db`
- **THEN** the effective database path resolves relative to `config/dev/`
- **THEN** the CLI does not reinterpret that value relative to an unrelated shell working directory
