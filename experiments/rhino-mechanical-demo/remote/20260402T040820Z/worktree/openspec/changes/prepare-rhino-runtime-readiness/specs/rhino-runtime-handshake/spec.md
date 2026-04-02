## ADDED Requirements

### Requirement: The Rhino bridge contract SHALL expose runtime handshake methods
The system SHALL support JSON-RPC methods `rhino.system.ping` and `rhino.system.describe_runtime` in addition to geometry execution methods.

#### Scenario: Ping verifies basic bridge availability
- **WHEN** the core sends `rhino.system.ping` to an available bridge
- **THEN** the bridge returns a successful JSON-RPC response
- **THEN** the response confirms that the transport endpoint is reachable

#### Scenario: Describe runtime returns readiness metadata
- **WHEN** the core sends `rhino.system.describe_runtime` to an available bridge
- **THEN** the bridge returns runtime metadata including bridge kind, runtime version, transport, endpoint, license status, and supported methods
- **THEN** the response uses the same JSON-RPC envelope shape as execution responses

### Requirement: The core SHALL preflight bridge execution with runtime inspection
The system SHALL inspect the bridge runtime successfully before dispatching geometry methods from `run`.

#### Scenario: Run stops before geometry dispatch when handshake fails
- **WHEN** the active bridge endpoint is unavailable or the runtime inspection request fails
- **THEN** the CLI exits before sending the geometry execution method
- **THEN** no fake success result is printed

#### Scenario: Run continues after successful runtime inspection
- **WHEN** `rhino.system.describe_runtime` succeeds for the active bridge
- **THEN** the CLI proceeds to dispatch the validated geometry action
- **THEN** the existing create and move flows continue to work through the same bridge contract
