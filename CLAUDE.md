# Claude Development Notes

## Project Context
This is a Next.js application for extracting ZIP codes from Worldpay transactions. The app integrates with:
- **CrunchyBridge PostgreSQL** database (staging cluster: `squadup-staging`)
- **Worldpay/Payrix API** for ZIP code extraction
- **Shadcn UI components** for modern interface

## Important Files to Maintain

### 📋 Always Update These Files
1. **`todos.md`** - Comprehensive development log and task tracking
   - Document all new features and fixes
   - Include technical implementation details
   - Track known issues and future enhancements
   - Update after every significant change

2. **`DATABASE_SETUP.md`** - Database configuration guide
   - Update when database schema changes
   - Include new connection requirements
   - Document new environment variables

3. **`.env.local`** - Environment configuration
   - Keep staging/production settings clear
   - Document API endpoint changes needed for production
   - Maintain security best practices

## Current Architecture

### Database Layer (`lib/db.ts`)
- **Connection**: Read-only PostgreSQL via CrunchyBridge
- **Key Tables**: `payments`, `events`, `users`
- **Relationships**: payments → events → host users
- **Security**: SSL required, connection pooling, read-only transactions

### API Layer 
- **Route**: `/api/query-transactions` - Main database query endpoint
- **Route**: `/api/fetch-zip` - Legacy manual ZIP extraction
- **External**: Worldpay/Payrix API for ZIP code retrieval

### Frontend (`app/page.tsx`)
- **UI Framework**: Tailwind CSS + Shadcn components
- **State Management**: React hooks
- **Components**: Custom DatePicker, responsive tables, toast notifications

## Development Workflow

### Before Making Changes
1. ✅ Read `todos.md` to understand current state
2. ✅ Check environment settings in `.env.local`
3. ✅ Review database schema if touching data layer
4. ✅ Test with staging environment first

### After Making Changes
1. ✅ Update `todos.md` with new features/fixes
2. ✅ Run `npm run lint` to ensure code quality
3. ✅ Test critical user paths
4. ✅ Update documentation if API or schema changes
5. ✅ Commit with descriptive messages

## Critical Configuration

### Environment Variables
```env
# Staging (current)
WORLDPAY_API_KEY=a708d763b5c3cad415693f2010a647cb
DATABASE_URL=postgres://application:...@p.7z2doxleybbkxl4v5mwgruubeq.db.postgresbridge.com:5431/postgres

# Production (for deployment)
# WORLDPAY_API_KEY=production_key_here
# DATABASE_URL=postgres://readonly_user:...@production_host:5432/postgres
```

### Required Updates for Production
1. Change API endpoint from `test-api.payrix.com` to `api.payrix.com`
2. Switch to production database connection
3. Update Vercel environment variables
4. Use production API key

## Security Notes
- ✅ Database access is read-only
- ✅ API keys stored in environment variables
- ✅ SSL connections required
- ✅ Input validation and sanitization implemented
- ✅ Rate limiting on external API calls

## Common Issues & Solutions

### Date Range Problems
- **Issue**: Timezone conversion causing missed transactions
- **Solution**: Use PostgreSQL `::date` casting for local date comparisons

### API Rate Limiting
- **Issue**: Too many rapid API calls
- **Solution**: 100ms delay between Worldpay API requests

### Database Connection Issues
- **Issue**: SSL or authentication failures
- **Solution**: Verify CrunchyBridge credentials and SSL settings

## Performance Considerations
- Database queries use proper JOINs and indexing
- API calls are batched with delays
- Frontend uses lazy loading and pagination
- Connection pooling prevents resource exhaustion

## Monitoring & Maintenance
- Monitor API usage and costs
- Track database query performance
- Review error logs regularly
- Keep dependencies updated
- Test timezone handling with edge cases

---

**Remember**: Always update `todos.md` after significant changes to maintain project continuity!