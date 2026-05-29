import { createClient } from '@supabase/supabase-js'
import fs from 'fs/promises'

// Load environment variables
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables!')
  console.error('Please create a .env file with SUPABASE_URL and SUPABASE_SERVICE_KEY')
  process.exit(1)
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function fetchData() {
  console.log('📥 Fetching data from Supabase...\n')

  try {
    // Customize this query for your experiment
    const { data, error } = await supabase
      .from('cards') // Change table name as needed
      .select('*')   // Specify columns: 'id, title, content, tags'
      .limit(30)     // Adjust sample size

    if (error) throw error

    if (!data || data.length === 0) {
      console.error('⚠️  No data returned from query')
      console.error('Check your table name and filters')
      process.exit(1)
    }

    console.log(`✅ Fetched ${data.length} items`)

    // Ensure data directory exists
    await fs.mkdir('data', { recursive: true })

    // Save to JSON
    await fs.writeFile(
      'data/input.json',
      JSON.stringify(data, null, 2)
    )

    console.log('💾 Saved to data/input.json\n')
    console.log('Sample data:')
    console.log(JSON.stringify(data[0], null, 2))

  } catch (error) {
    console.error('❌ Error fetching data:', error)
    process.exit(1)
  }
}

fetchData()
