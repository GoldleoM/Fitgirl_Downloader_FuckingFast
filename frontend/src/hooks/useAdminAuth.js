import { useState, useEffect, useCallback } from 'react';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

// Only this email is allowed to be admin — no sign-up endpoint exists
const ADMIN_EMAIL = 'aaronjain100@gmail.com';

export function useAdminAuth() {
    const [adminUser, setAdminUser] = useState(null);
    const [isAdminLoading, setIsAdminLoading] = useState(true);
    const [adminError, setAdminError] = useState('');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user && user.email === ADMIN_EMAIL) {
                setAdminUser(user);
            } else {
                setAdminUser(null);
                // If someone else somehow signed in, sign them out
                if (user && user.email !== ADMIN_EMAIL) {
                    signOut(auth);
                }
            }
            setIsAdminLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const adminLogin = useCallback(async (email, password) => {
        setAdminError('');
        if (email !== ADMIN_EMAIL) {
            setAdminError('Unauthorized.');
            return false;
        }
        try {
            const cred = await signInWithEmailAndPassword(auth, email, password);
            if (cred.user.email === ADMIN_EMAIL) {
                setAdminUser(cred.user);
                return true;
            } else {
                await signOut(auth);
                setAdminError('Unauthorized.');
                return false;
            }
        } catch (err) {
            const msg = err.code === 'auth/invalid-credential' ? 'Invalid credentials.'
                : err.code === 'auth/too-many-requests' ? 'Too many attempts. Try later.'
                : err.code === 'auth/user-not-found' ? 'Unauthorized.'
                : 'Login failed.';
            setAdminError(msg);
            return false;
        }
    }, []);

    const adminLogout = useCallback(async () => {
        await signOut(auth);
        setAdminUser(null);
    }, []);

    return { adminUser, isAdminLoading, adminError, adminLogin, adminLogout, setAdminError };
}
