#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Database connection string for local development
DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

echo "Running verification tests..."

# Test 1: Verify test organization exists
echo -n "Test 1 - Organization exists: "
if psql "$DB_URL" -t -c "SELECT id FROM organizations WHERE id = 'e33cfa71-4a35-412e-89ac-0093a2ab8b68';" | grep -q "e33cfa71-4a35-412e-89ac-0093a2ab8b68"; then
    echo -e "${GREEN}PASSED${NC}"
else
    echo -e "${RED}FAILED${NC}"
fi

# Test 2: Verify customer user exists
echo -n "Test 2 - Customer user exists: "
if psql "$DB_URL" -t -c "SELECT id FROM profiles WHERE id = '00000000-0000-0000-0000-000000000001';" | grep -q "00000000-0000-0000-0000-000000000001"; then
    echo -e "${GREEN}PASSED${NC}"
else
    echo -e "${RED}FAILED${NC}"
fi

# Test 3: Verify agent user exists
echo -n "Test 3 - Agent user exists: "
if psql "$DB_URL" -t -c "SELECT id FROM profiles WHERE id = '00000000-0000-0000-0000-000000000002';" | grep -q "00000000-0000-0000-0000-000000000002"; then
    echo -e "${GREEN}PASSED${NC}"
else
    echo -e "${RED}FAILED${NC}"
fi

# Test 4: Verify test ticket exists
echo -n "Test 4 - Test ticket exists: "
if psql "$DB_URL" -t -c "SELECT id FROM tickets WHERE id = '4c723838-53b9-4ded-9333-8d71f30175c9';" | grep -q "4c723838-53b9-4ded-9333-8d71f30175c9"; then
    echo -e "${GREEN}PASSED${NC}"
else
    echo -e "${RED}FAILED${NC}"
fi

# Test 5: Verify test comment exists
echo -n "Test 5 - Test comment exists: "
if psql "$DB_URL" -t -c "SELECT id FROM comments WHERE id = 'f86424d4-7f45-4899-974f-8c96387d5e8e';" | grep -q "f86424d4-7f45-4899-974f-8c96387d5e8e"; then
    echo -e "${GREEN}PASSED${NC}"
else
    echo -e "${RED}FAILED${NC}"
fi

# Test 6: Verify customer belongs to organization
echo -n "Test 6 - Customer-org relationship: "
if psql "$DB_URL" -t -c "SELECT org_id FROM profiles WHERE id = '00000000-0000-0000-0000-000000000001' AND org_id = 'e33cfa71-4a35-412e-89ac-0093a2ab8b68';" | grep -q "e33cfa71-4a35-412e-89ac-0093a2ab8b68"; then
    echo -e "${GREEN}PASSED${NC}"
else
    echo -e "${RED}FAILED${NC}"
fi

# Test 7: Verify ticket belongs to organization
echo -n "Test 7 - Ticket-org relationship: "
if psql "$DB_URL" -t -c "SELECT org_id FROM tickets WHERE id = '4c723838-53b9-4ded-9333-8d71f30175c9' AND org_id = 'e33cfa71-4a35-412e-89ac-0093a2ab8b68';" | grep -q "e33cfa71-4a35-412e-89ac-0093a2ab8b68"; then
    echo -e "${GREEN}PASSED${NC}"
else
    echo -e "${RED}FAILED${NC}"
fi

# Test 8: Verify comment belongs to ticket
echo -n "Test 8 - Comment-ticket relationship: "
if psql "$DB_URL" -t -c "SELECT ticket_id FROM comments WHERE id = 'f86424d4-7f45-4899-974f-8c96387d5e8e' AND ticket_id = '4c723838-53b9-4ded-9333-8d71f30175c9';" | grep -q "4c723838-53b9-4ded-9333-8d71f30175c9"; then
    echo -e "${GREEN}PASSED${NC}"
else
    echo -e "${RED}FAILED${NC}"
fi

# Test 9: Verify customer role is set correctly
echo -n "Test 9 - Customer role check: "
if psql "$DB_URL" -t -c "SELECT role FROM profiles WHERE id = '00000000-0000-0000-0000-000000000001' AND role = 'customer';" | grep -q "customer"; then
    echo -e "${GREEN}PASSED${NC}"
else
    echo -e "${RED}FAILED${NC}"
fi

# Test 10: Verify agent role is set correctly
echo -n "Test 10 - Agent role check: "
if psql "$DB_URL" -t -c "SELECT role FROM profiles WHERE id = '00000000-0000-0000-0000-000000000002' AND role = 'agent';" | grep -q "agent"; then
    echo -e "${GREEN}PASSED${NC}"
else
    echo -e "${RED}FAILED${NC}"
fi

echo "All tests completed." 