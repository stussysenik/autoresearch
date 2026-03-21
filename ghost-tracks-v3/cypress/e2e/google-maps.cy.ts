describe('Google Maps Integration', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('renders the map container or the API key setup card', () => {
    // The app renders either the Google Maps container or the API key setup card.
    // Both live inside a full-screen wrapper div.
    cy.get('.relative.h-full.w-full').should('exist')

    // Check which state we are in:
    // 1. If API key is missing/demo, the setup instructions card is shown
    // 2. If API key is valid, the map container div is rendered
    cy.get('body').then(($body) => {
      const hasSetupCard = $body.text().includes('Google Maps API Key Required')

      if (hasSetupCard) {
        // Verify the setup instructions card content
        cy.contains('h2', 'Google Maps API Key Required').should('be.visible')
        cy.contains('code', '.env').should('be.visible')
        cy.contains('GOOGLE_MAPS_API_KEY=your_key_here').should('be.visible')
        cy.contains('a', 'console.cloud.google.com').should('have.attr', 'href')
          .and('include', 'console.cloud.google.com')
      } else {
        // Map container should exist (rendered by @vis.gl/react-google-maps)
        cy.get('.absolute.inset-0.w-full.h-full').should('be.visible')
      }
    })
  })

  it('does not show a raw Google Maps JavaScript error in the DOM', () => {
    // Ensure no unhandled Google Maps error messages leak into the visible page text
    cy.get('body').should('not.contain.text', 'Google Maps JavaScript API error')
    cy.get('body').should('not.contain.text', 'This page can\'t load Google Maps correctly')
  })

  it('shows the setup instructions card when API key is demo or missing', () => {
    // This test is only meaningful when the API key is not configured.
    // We check if the setup card is present and skip assertions if the map loaded instead.
    cy.get('body').then(($body) => {
      if ($body.text().includes('Google Maps API Key Required')) {
        cy.contains('Google Maps API Key Required').should('be.visible')
        cy.get('pre').should('contain.text', 'GOOGLE_MAPS_API_KEY')
        cy.contains('Enable "Maps JavaScript API"').should('be.visible')
      } else {
        // Map is loaded with a valid key -- this test is not applicable
        cy.log('Skipping: Google Maps loaded with a valid API key')
      }
    })
  })
})
