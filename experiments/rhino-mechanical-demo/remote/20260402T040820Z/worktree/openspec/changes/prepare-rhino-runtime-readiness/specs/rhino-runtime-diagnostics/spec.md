## ADDED Requirements

### Requirement: The CLI SHALL expose effective runtime inspection
The system SHALL provide a runtime inspection command that prints the effective runtime configuration and the source of each resolved field.

#### Scenario: Human-readable config inspection shows values and sources
- **WHEN** the user runs `config show`
- **THEN** the CLI prints the effective session id, database path, bridge profile, and endpoint
- **THEN** the CLI shows whether each field came from defaults, dotenv, environment variables, or CLI overrides

#### Scenario: JSON config inspection is machine-readable
- **WHEN** the user runs `config show --json`
- **THEN** the CLI prints a structured JSON document with the effective runtime configuration
- **THEN** the document includes field-source metadata

### Requirement: The CLI SHALL expose bridge runtime diagnostics
The system SHALL provide a bridge diagnostics command that pings the active bridge and prints its reported runtime metadata.

#### Scenario: Bridge status reports runtime details for an available bridge
- **WHEN** the user runs `bridge status` against an available bridge
- **THEN** the CLI verifies bridge availability with `rhino.system.ping`
- **THEN** the CLI prints the bridge profile, runtime version, transport, endpoint, license status, and supported methods

#### Scenario: Bridge status surfaces transport failures clearly
- **WHEN** the active bridge endpoint is unavailable
- **THEN** the CLI exits with a transport error that identifies bridge unavailability
- **THEN** the CLI does not print a fake ready status
