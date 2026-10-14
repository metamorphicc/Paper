import { Suspense } from 'react';
import Profile from '../../components/profile';
export default function ProfilePage() { return <><section className="page-heading"><div><h1>Профиль адреса</h1><p>Публичные balances, PAPER и история. Подпись для просмотра не нужна.</p></div></section><Suspense fallback={<p>Загрузка профиля…</p>}><Profile /></Suspense></>; }
