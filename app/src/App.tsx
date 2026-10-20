import { useCallback, useState } from 'react';
import { useRoute, navigate } from './lib/router.ts';
import { usePlans } from './lib/usePlans.ts';
import { LibraryPage } from './pages/LibraryPage.tsx';
import { EditorPage } from './pages/EditorPage.tsx';
import { RunPage } from './pages/RunPage.tsx';
import { Toast } from './components/feedback.tsx';

function NotFound() {
  return (
    <div className="shell">
      <div className="card empty">
        <h1 className="card-title">That class isn't here</h1>
        <p className="muted" style={{ margin: 0 }}>
          Plans are saved on the device they were made on.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => navigate({ name: 'library' })}>
          Back to classes
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const route = useRoute();
  const api = usePlans();
  const [toast, setToast] = useState<string | null>(null);
  const notify = useCallback((m: string) => setToast(m), []);
  const clearToast = useCallback(() => setToast(null), []);

  let page;
  if (route.name === 'library') {
    page = <LibraryPage api={api} notify={notify} />;
  } else {
    const plan = api.get(route.id);
    if (!plan) page = <NotFound />;
    else if (route.name === 'run') page = <RunPage plan={plan} />;
    else page = <EditorPage key={plan.id} plan={plan} api={api} notify={notify} />;
  }

  return (
    <>
      {page}
      {toast && <Toast message={toast} onDone={clearToast} />}
    </>
  );
}
