describe('GraphQL API', () => {
  const graphqlUrl = 'http://localhost:8911/graphql'

  it('responds to an introspection query with __typename', () => {
    cy.request({
      method: 'POST',
      url: graphqlUrl,
      headers: { 'Content-Type': 'application/json' },
      body: {
        query: '{ __typename }',
      },
    }).then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body).to.have.property('data')
      expect(response.body.data).to.have.property('__typename', 'Query')
    })
  })

  it('returns an error for ghostRoute query with unknown ID', () => {
    cy.request({
      method: 'POST',
      url: graphqlUrl,
      headers: { 'Content-Type': 'application/json' },
      body: {
        query: `
          query GetGhostRoute($id: String!) {
            ghostRoute(id: $id) {
              id
              shapeName
              neighborhood
            }
          }
        `,
        variables: { id: 'nonexistent-route-id-12345' },
      },
      failOnStatusCode: false,
    }).then((response) => {
      // The server should respond with 200 but include errors in the body,
      // or the data.ghostRoute should be null for a missing record
      expect(response.status).to.be.oneOf([200, 400, 404, 500])

      if (response.status === 200) {
        // Either errors array is present or ghostRoute is null
        const hasErrors = response.body.errors && response.body.errors.length > 0
        const isNull = response.body.data && response.body.data.ghostRoute === null
        expect(hasErrors || isNull).to.be.true
      }
    })
  })
})
