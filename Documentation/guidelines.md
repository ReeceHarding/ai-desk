# Gmail Integration Guidelines

## Database Schema Relationships

### Profile and Organization Relationship
- Profiles have a direct relationship to organizations via `org_id`
- Never query organizations table directly with a profile ID
- Always use the profile's `org_id` to query the organizations table
- Both profiles and organizations can have Gmail tokens

### Gmail Token Storage
- Gmail tokens are stored in both profiles and organizations tables
- Fields in both tables:
  - `gmail_access_token`
  - `gmail_refresh_token`
  - `gmail_watch_expiration`
  - `gmail_watch_resource_id`
  - `gmail_watch_status`

## Gmail Client Initialization

### Using `getGmailClient`
- Always specify the type parameter ('profile' or 'organization') when calling `getGmailClient`
- Default type is 'organization' for backward compatibility
- When using profile ID, always pass type='profile'
- Function will automatically:
  1. Get the correct tokens based on type
  2. For profiles, get the org_id and use profile's tokens
  3. For organizations, use organization's tokens directly

### Watch Setup
- When setting up Gmail watch:
  - Pass the correct type parameter
  - For profiles, use the profile ID with type='profile'
  - For organizations, use the organization ID with type='organization'
- Watch information is stored in both tables to maintain consistency

## Common Pitfalls to Avoid

1. **ID Type Mismatch**
   - Don't use profile IDs where organization IDs are expected
   - Always check the type of ID being passed

2. **Token Management**
   - Don't assume tokens exist in organizations table only
   - Check both profile and organization tokens based on context

3. **Watch Setup**
   - Don't set up watches without specifying the correct type
   - Ensure watch expiration is properly tracked in both tables

4. **Database Queries**
   - Don't query organizations table directly with profile IDs
   - Always join through the profile's org_id when needed

## Testing Guidelines

When implementing Gmail-related features:

1. **Token Testing**
   - Test token refresh for both profiles and organizations
   - Verify tokens are properly stored in both tables

2. **Watch Setup Testing**
   - Test watch setup for both profiles and organizations
   - Verify watch information is correctly stored
   - Test watch expiration and renewal

3. **Error Handling**
   - Test scenarios where tokens are missing
   - Test scenarios where watch setup fails
   - Verify error messages are helpful and specific

## Code Review Checklist

When reviewing Gmail-related changes:

- [ ] Correct type parameter is used with `getGmailClient`
- [ ] Profile/Organization ID usage is appropriate
- [ ] Token storage is handled correctly
- [ ] Watch setup includes correct type parameter
- [ ] Error handling is comprehensive
- [ ] Database queries use correct relationships
- [ ] No direct organization queries with profile IDs

## Maintenance Tasks

Regular maintenance should include:

1. **Watch Management**
   - Monitor watch expirations
   - Verify watch renewal process
   - Clean up expired watches

2. **Token Verification**
   - Regular token validation
   - Proper token refresh handling
   - Token storage consistency

3. **Database Integrity**
   - Verify profile-organization relationships
   - Check token and watch status consistency
   - Clean up orphaned records

## Future Considerations

When extending Gmail functionality:

1. **New Features**
   - Maintain profile/organization distinction
   - Update both tables when needed
   - Keep token and watch management consistent

2. **Schema Updates**
   - Add new fields to both tables when relevant
   - Maintain relationship integrity
   - Consider migration impact

3. **API Changes**
   - Handle both profile and organization contexts
   - Maintain backward compatibility
   - Document type requirements clearly
