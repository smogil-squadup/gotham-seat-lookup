# Wizard & Form Tabs - New Features

This document explains the new Wizard and Form tabs added to the Worldpay ZIP Code Extractor.

## 🧙‍♂️ Wizard Tab - Natural Language to SQL

### Overview
The Wizard tab allows you to describe what data you want in plain English, and it automatically converts your request to SQL using AI.

### Features
- **Natural Language Input**: Write queries like "Show me all payments from the last 30 days"
- **AI-Powered Conversion**: Uses Groq's Llama 3.1 model for fast, accurate SQL generation
- **SQL Preview & Editing**: View and modify the generated SQL before execution
- **Full ZIP Code Integration**: Automatically fetches ZIP codes from Worldpay API

### Setup Required
1. **Get a Free Groq API Key**:
   - Visit: https://console.groq.com/keys
   - Sign up for a free account
   - Create an API key

2. **Add to Environment**:
   - Update `.env.local` file
   - Replace `your_groq_api_key_here` with your actual key:
   ```
   GROQ_API_KEY=gsk_your_actual_key_here
   ```

### Example Queries
```
• Show me all payments from the last 30 days
• Find transactions over $100 that failed  
• Get all successful payments with ZIP codes from this year
• Show payments for user ID 12345 sorted by amount
• List all events with their payment totals
• Find failed transactions from December 2024
```

### How It Works
1. Enter natural language description
2. Click "Generate & Execute"
3. AI converts to SQL and shows preview
4. SQL executes against database
5. ZIP codes fetched from Worldpay API
6. Results displayed in table

---

## 📝 Form Tab - GUI Query Builder

### Overview
The Form tab provides a simple, form-based interface for building database queries without writing SQL.

### Features
- **Table Selection**: Choose from payments, events, users, or joined data
- **Sort Options**: Sort by date, amount, ID in ascending/descending order
- **Result Limits**: Choose 10, 50, 100, 500, or 1000 results
- **SQL Preview**: See the generated SQL query before execution
- **ZIP Code Integration**: Automatically fetches ZIP codes for transaction results

### Available Tables
- **Payments**: Core payment transaction data
- **Events**: Event information and metadata
- **Users**: User account details
- **Payments with Events (JOIN)**: Combined payment and event data

### Sort Options
- **Newest First**: `ORDER BY created_at DESC`
- **Oldest First**: `ORDER BY created_at ASC` 
- **Highest Amount**: `ORDER BY amount DESC`
- **Lowest Amount**: `ORDER BY amount ASC`
- **Latest ID**: `ORDER BY id DESC`
- **Earliest ID**: `ORDER BY id ASC`

### How It Works
1. Select database table
2. Choose sort order and limit
3. Preview generated SQL
4. Click "Run Query"
5. SQL executes against database
6. ZIP codes fetched from Worldpay API
7. Results displayed in table

---

## 🔄 Workflow Comparison

| Tab | Best For | Skill Level | Flexibility |
|-----|----------|-------------|-------------|
| **Manual** | Specific transaction IDs | Beginner | Low |
| **SQL** | Custom complex queries | Advanced | High |
| **Wizard** | Natural language requests | Intermediate | High |
| **Form** | Simple structured queries | Beginner | Medium |

## 🎯 Use Cases

### Wizard Tab
- Exploratory data analysis
- Ad-hoc reporting requests
- When you know what you want but not the SQL
- Quick prototyping of complex queries

### Form Tab  
- Standard reporting needs
- When you want to browse table data
- Quick lookups without SQL knowledge
- Consistent, repeatable queries

## 🔧 Technical Details

### Wizard Tab Implementation
- **AI Model**: Groq Llama 3.1 70B (fast inference)
- **API**: `/api/nl-to-sql` endpoint
- **Security**: Only SELECT statements allowed
- **Cost**: Free tier with generous limits

### Form Tab Implementation
- **Frontend**: React form controls
- **Backend**: Uses existing `/api/execute-sql` endpoint
- **Validation**: Form ensures valid SQL generation
- **Performance**: Simple queries execute quickly

## 🚀 Getting Started

1. **For Wizard Tab**:
   - Set up Groq API key (see setup section above)
   - Try example queries
   - Experiment with natural language descriptions

2. **For Form Tab**:
   - No setup required
   - Start with "Payments" table
   - Try different sort options and limits

## 🔒 Security

- All tabs use read-only database connections
- SQL injection prevention through parameterized queries
- Only SELECT statements allowed
- Rate limiting on external API calls
- Environment variable protection for API keys

## 📊 Performance

- **Wizard**: ~2-3 seconds (AI conversion + DB query + ZIP codes)
- **Form**: ~1-2 seconds (DB query + ZIP codes) 
- **Caching**: ZIP code API responses cached for efficiency
- **Limits**: Maximum 1000 results per query

Both tabs maintain the same high-quality ZIP code integration as the existing SQL tab!