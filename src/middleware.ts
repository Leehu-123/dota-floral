import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: { signIn: '/login' },
});

export const config = {
  matcher: [
    '/((?!login|api/auth|api/tunnel|mobile-qr|_next/static|_next/image|favicon.ico|manifest\\.json|icons|sw\\.js).*)',
  ],
};
