describe('App Shell', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('loads the app without crashing', () => {
    cy.get('body').should('be.visible')
  })

  it('displays the ghost logo', () => {
    // The ghost emoji is rendered in a rounded-full div as the app logo
    cy.contains('div', '\uD83D\uDC7B').should('be.visible')
  })

  it('shows the mode switcher with Generate and Describe buttons', () => {
    cy.get('[data-testid="mode-switcher"]').should('be.visible')
    cy.get('[data-testid="mode-generate"]').should('be.visible').and('contain.text', 'Generate')
    cy.get('[data-testid="mode-describe"]').should('be.visible').and('contain.text', 'Describe')
  })

  it('defaults to Generate mode with the neighborhood dropdown present', () => {
    // Generate button should be active (has the orange bg class)
    cy.get('[data-testid="mode-generate"]').should('have.class', 'bg-[#FF6B35]')

    // Neighborhood dropdown should be visible in Generate mode
    cy.get('select').should('be.visible')
    cy.get('select').find('option').first().should('contain.text', 'Choose a neighborhood')
  })

  it('renders in a full-screen layout', () => {
    // The root layout div uses h-full w-full for full-screen coverage
    cy.get('.relative.h-full.w-full').should('exist')
  })
})
