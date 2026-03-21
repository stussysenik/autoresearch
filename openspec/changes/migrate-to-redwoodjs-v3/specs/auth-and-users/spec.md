## ADDED Requirements

### Requirement: RedwoodJS dbAuth for Email/Password Authentication

The application SHALL use RedwoodJS dbAuth as its authentication provider. Authentication MUST be based on email and password credentials, with passwords hashed and salted before storage.

#### Scenario: Signup creates user

WHEN a visitor submits the signup form with email `runner@example.com` and a valid password
THEN a new User record SHALL be created in the database
AND the `hashedPassword` and `salt` fields SHALL be populated (plain-text password MUST NOT be stored)
AND the user SHALL be automatically logged in with an active session

### Requirement: Login, Signup, and ForgotPassword Pages

The application SHALL provide three authentication pages:
- **Login page**: email and password fields with a submit button
- **Signup page**: email, password, and password confirmation fields
- **ForgotPassword page**: email field to initiate password reset

Each page MUST be accessible without authentication.

#### Scenario: Login returns session

WHEN a registered user submits valid credentials on the login page
THEN a session SHALL be created for the user
AND subsequent requests SHALL include the session cookie identifying the authenticated user
AND the user SHALL be redirected to the application dashboard

### Requirement: @requireAuth GraphQL Directive on Protected Mutations

The following GraphQL mutations SHALL be protected by the `@requireAuth` directive:
- Save route (createGhostRoute, updateGhostRoute)
- Favorite route (createFavorite, deleteFavorite)
- Share route (generating or updating shareSlug)
- Delete route (deleteGhostRoute)

Unauthenticated requests to these mutations MUST be rejected with an authorization error.

#### Scenario: Unauthenticated user blocked from saving

WHEN an unauthenticated user attempts to call the `createGhostRoute` mutation
THEN the GraphQL API SHALL return an authentication error
AND no GhostRoute record SHALL be created

### Requirement: Session Management via Secure Cookie

User sessions SHALL be managed via a secure HTTP-only cookie. The session cookie MUST use the following security settings:
- `HttpOnly`: true
- `Secure`: true (in production)
- `SameSite`: Strict

The `SESSION_SECRET` environment variable SHALL be used to sign session cookies.

#### Scenario: Session cookie is secure

WHEN a user logs in successfully
THEN the response SHALL set a cookie with `HttpOnly` and `SameSite=Strict` attributes
AND the cookie SHALL be signed using the `SESSION_SECRET`

### Requirement: Guest Route Generation Without Auth

Unauthenticated (guest) users SHALL be able to generate routes without logging in. The route generation pipeline (shape selection, coordinate generation, street-snapping) MUST NOT require authentication.

#### Scenario: Unauthenticated user generates route

WHEN a guest user selects a shape and city and triggers route generation
THEN the route generation pipeline SHALL execute successfully
AND the generated route SHALL be displayed on the map
AND the user SHALL NOT be prompted to log in during generation

### Requirement: Auth Required Only for Persistence Operations

Authentication SHALL be required only for the following operations:
- Saving routes to the user's account
- Favoriting routes
- Sharing routes (generating share slugs)
- Exporting routes to Strava

All other operations (browsing, generating, viewing shared routes) MUST remain accessible without authentication.

#### Scenario: Password reset flow works

WHEN a user requests a password reset for their registered email
THEN a password reset token SHALL be generated
AND the user SHALL be able to set a new password using the token
AND the old password SHALL no longer be valid after reset
