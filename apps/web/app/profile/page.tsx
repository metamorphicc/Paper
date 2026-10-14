import { Suspense } from 'react';
import Profile from '../../components/profile';
export default function ProfilePage() {
  return (
    <>
      <section className="page-heading">
        <div>
          <h1>Profile</h1>
          <p> Public balances, PAPER and history. No signature needed to view. </p>
        </div>
      </section>
      <Suspense fallback={<p> Loading profile… </p>}>
        <Profile />
      </Suspense>
    </>
  );
}
