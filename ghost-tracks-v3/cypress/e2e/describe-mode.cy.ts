describe('Describe Mode', () => {
  beforeEach(() => {
    cy.visit('/')
    // Switch to Describe mode
    cy.get('[data-testid="mode-describe"]').click()
  })

  it('shows the text input in Describe mode', () => {
    cy.get('[data-testid="describe-input"]').should('be.visible')
    cy.get('[data-testid="describe-input"]')
      .should('have.attr', 'placeholder')
      .and('contain', 'Describe your shape')
  })

  it('disables the submit button when input is empty', () => {
    cy.get('[data-testid="describe-button"]').should('be.disabled')
  })

  it('enables the submit button when text is entered', () => {
    cy.get('[data-testid="describe-input"]').type('a heart shape')
    cy.get('[data-testid="describe-button"]').should('not.be.disabled')
    cy.get('[data-testid="describe-button"]').should('contain.text', 'Create Route')
  })

  it('clears the input when Escape is pressed', () => {
    cy.get('[data-testid="describe-input"]').type('a star')
    cy.get('[data-testid="describe-input"]').should('have.value', 'a star')
    cy.get('[data-testid="describe-input"]').type('{esc}')
    cy.get('[data-testid="describe-input"]').should('have.value', '')
  })

  it('expands the neighborhood preference toggle', () => {
    // Click the "Neighborhood preference" toggle button
    cy.contains('button', 'Neighborhood preference').should('be.visible').click()

    // After expanding, a select dropdown should appear with "Let AI decide" as the default
    cy.get('select').should('be.visible')
    cy.get('select').find('option').first().should('contain.text', 'Let AI decide')
  })

  it('shows help text with shape suggestions', () => {
    cy.contains('a heart shape').should('be.visible')
    cy.contains('letter P').should('be.visible')
    cy.contains('a star').should('be.visible')
  })
})
