## ADDED Requirements

### Requirement: The core SHALL resolve a concrete bridge profile and endpoint before execution
The system SHALL resolve a bridge profile and transport endpoint before any bridge-facing command runs. The initial supported profiles SHALL include `mock-rhino` and `rhino-inside`.

#### Scenario: Default profile targets the mock bridge
- **WHEN** no bridge profile is configured through dotenv, environment variables, or CLI flags
- **THEN** the effective bridge profile is `mock-rhino`
- **THEN** the effective transport endpoint is the configured local socket path

#### Scenario: The real Rhino profile can be selected without code changes
- **WHEN** the user sets `RHINO_NLCLI_BRIDGE_PROFILE=rhino-inside` or passes an equivalent CLI override
- **THEN** the CLI resolves the `rhino-inside` bridge profile
- **THEN** subsequent bridge-facing commands use that selected profile and endpoint metadata

### Requirement: Bridge-hosting commands SHALL reuse the resolved endpoint settings
Commands that host or inspect a bridge SHALL use the same resolved endpoint settings as execution commands.

#### Scenario: The mock bridge server uses configured endpoint overrides
- **WHEN** the user starts `bridge mock-rhino` with a configured or overridden socket path
- **THEN** the mock bridge listens on that effective socket path
- **THEN** `run` and `bridge status` can target the same endpoint without duplicating configuration
