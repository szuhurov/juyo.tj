import '@testing-library/jest-dom';

// Supabase env vars for tests — real values not needed, mocks intercept calls
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
