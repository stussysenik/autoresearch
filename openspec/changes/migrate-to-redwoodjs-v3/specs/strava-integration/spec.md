## ADDED Requirements

### Requirement: Strava OAuth2 Link Account Flow

Strava integration SHALL use an OAuth2 "link account" flow, separate from the primary dbAuth login. Users MUST first be authenticated via dbAuth before connecting their Strava account. Strava SHALL NOT be used as a primary authentication provider.

#### Scenario: User connects Strava via OAuth

WHEN an authenticated user clicks the "Connect Strava" button on their profile page
THEN the application SHALL redirect the user to `https://www.strava.com/oauth/authorize`
AND upon authorization, Strava SHALL redirect back to the application's callback URL
AND the user's Strava account SHALL be linked to their existing User record

### Requirement: OAuth Redirect with Required Scopes

The OAuth authorization request SHALL redirect to `https://www.strava.com/oauth/authorize` with the following parameters:
- `client_id`: from `STRAVA_CLIENT_ID` environment variable
- `redirect_uri`: the application's callback URL
- `response_type`: `code`
- `scope`: `activity:write,read`

The `activity:write` scope is REQUIRED for GPX upload functionality. The `read` scope is REQUIRED for reading activity data.

#### Scenario: OAuth redirect includes correct scopes

WHEN the OAuth redirect URL is constructed
THEN the `scope` parameter SHALL include `activity:write,read`
AND the `client_id` SHALL be sourced from the `STRAVA_CLIENT_ID` environment variable

### Requirement: Token Exchange on Callback

The OAuth callback function SHALL exchange the authorization code for tokens by making a POST request to `https://www.strava.com/oauth/token` with:
- `client_id` from `STRAVA_CLIENT_ID`
- `client_secret` from `STRAVA_CLIENT_SECRET`
- `code` from the callback query parameter
- `grant_type`: `authorization_code`

The response SHALL provide `access_token`, `refresh_token`, and `expires_at`.

#### Scenario: Tokens stored after OAuth callback

WHEN the Strava OAuth callback is received with a valid authorization code
THEN the application SHALL exchange the code for an access token and refresh token
AND the `stravaAccessToken`, `stravaRefreshToken`, and `stravaTokenExpiry` fields SHALL be updated on the User record

### Requirement: Token Storage on User Model

Strava OAuth tokens SHALL be stored on the User model with the following fields:
- `stravaAccessToken`: the current access token
- `stravaRefreshToken`: the refresh token for obtaining new access tokens
- `stravaTokenExpiry`: the expiry timestamp of the current access token

These fields MUST be nullable to support users who have not connected Strava.

#### Scenario: Token fields are persisted

WHEN Strava tokens are saved to a User record
THEN all three token fields SHALL be populated
AND querying the User SHALL return the stored token values

### Requirement: Automatic Token Refresh on Expiry

Strava access tokens expire after approximately 6 hours. The application SHALL automatically refresh expired tokens before making Strava API calls by:
1. Checking if `stravaTokenExpiry` is in the past
2. If expired, POST to `https://www.strava.com/oauth/token` with `grant_type=refresh_token`
3. Updating the User record with the new `access_token`, `refresh_token`, and `expires_at`

#### Scenario: Tokens stored and refreshed on expiry

WHEN a Strava API call is initiated and the stored `stravaTokenExpiry` is in the past
THEN the application SHALL request a new access token using the refresh token
AND the User record SHALL be updated with the new token values
AND the original Strava API call SHALL proceed with the refreshed token

### Requirement: GPX Export to Strava

The application SHALL export routes to Strava by uploading a GPX file via `POST https://www.strava.com/api/v3/uploads` with:
- `file`: the GPX file content generated from the GhostRoute's routed coordinates
- `data_type`: `gpx`
- `activity_type`: `walk`

The upload MUST use the user's valid (non-expired) Strava access token in the `Authorization` header.

#### Scenario: GPX uploaded creates Strava activity

WHEN a user exports a GhostRoute to Strava
THEN the application SHALL generate a GPX file from the route's coordinates
AND the GPX file SHALL be uploaded to Strava via the uploads API
AND the Strava API SHALL return an upload ID confirming the upload

### Requirement: Strava Activity ID Stored on GhostRoute

After a successful GPX upload to Strava, the resulting Strava activity ID SHALL be stored on the GhostRoute record. This links the GhostRoute to its corresponding Strava activity for future reference.

#### Scenario: Activity ID linked to GhostRoute

WHEN a GPX upload to Strava completes successfully and Strava creates an activity
THEN the Strava activity ID SHALL be stored on the GhostRoute record
AND querying the GhostRoute SHALL return the associated Strava activity ID

### Requirement: Connect Strava Button on Profile Page

The user's profile page SHALL display a "Connect Strava" button when Strava is not yet linked. When Strava is already connected, the profile page SHALL display the connected status and a "Disconnect Strava" option.

#### Scenario: Disconnect removes tokens

WHEN a user clicks "Disconnect Strava" on their profile page
THEN the `stravaAccessToken`, `stravaRefreshToken`, and `stravaTokenExpiry` fields SHALL be set to null on the User record
AND the profile page SHALL revert to showing the "Connect Strava" button
