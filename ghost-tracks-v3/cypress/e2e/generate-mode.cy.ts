describe('Generate Mode', () => {
  beforeEach(() => {
    cy.visit('/')
    // Ensure we are in Generate mode (the default)
    cy.get('[data-testid="mode-generate"]').should('have.class', 'bg-[#FF6B35]')
  })

  it('disables the generate button when no neighborhood is selected', () => {
    cy.get('[data-testid="generate-button"]').should('be.disabled')
    cy.get('[data-testid="generate-button"]').should('contain.text', 'Generate Route Ideas')
  })

  it('enables the generate button after selecting a neighborhood', () => {
    cy.get('select').select('Vinohrady')
    cy.get('[data-testid="generate-button"]').should('not.be.disabled')
  })

  it('has all 12 Prague neighborhoods available in the dropdown', () => {
    const expectedNeighborhoods = [
      'Vinohrady',
      'Karl\u00edn',
      'Letn\u00e1',
      'Hole\u0161ovice',
      '\u017di\u017ekov',
      'Vr\u0161ovice',
      'Nusle',
      'Dejvice',
      'Sm\u00edchov',
      'Star\u00e9 M\u011bsto',
      'Mal\u00e1 Strana',
      'Nov\u00e9 M\u011bsto',
    ]

    // The select has 13 options: 1 placeholder + 12 neighborhoods
    cy.get('select').find('option').should('have.length', 13)

    expectedNeighborhoods.forEach((name) => {
      cy.get('select').find('option').contains(name).should('exist')
    })
  })

  it('allows selecting different neighborhoods', () => {
    cy.get('select').select('Letná')
    cy.get('select').should('have.value', 'Letná')

    cy.get('select').select('Žižkov')
    cy.get('select').should('have.value', 'Žižkov')
  })
})
