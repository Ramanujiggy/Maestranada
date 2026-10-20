import { useCallback, useState } from 'react';
import { useRoute, navigate } from './lib/router.ts';
import { usePlans } from './lib/usePlans.ts';
import { LibraryPage } from './pages/LibraryPage.tsx';
import { EditorPage } from './pages/EditorPage.tsx';
import { RunPage } from './pages/RunPage.tsx';
import { Toast } from './components/feedback.tsx';
import { Welcome } from './components/Welcome.tsx';
import { useInstall } from './lib/pwa.ts';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { usePendingFile } from './lib/files.ts';

const WELCOMED_KEY = 'maestranada.welcomed';

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return true;
  }
}

function setFlag(key: string): void {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // Private mode: the welcome just shows again next time.
  }
}

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
  const install = useInstall();
  const [welcomeOpen, setWelcomeOpen] = useState(() => !readFlag(WELCOMED_KEY));
  const [pickerOpen, setPickerOpen] = useState(false);
  const closeWelcome = useCallback(() => {
    setFlag(WELCOMED_KEY);
    setWelcomeOpen(false);
  }, []);

  const pendingFile = usePendingFile();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  let page;
  if (route.name === 'library') {
    page = (
      <LibraryPage
        api={api}
        notify={notify}
        install={install}
        onHelp={() => setWelcomeOpen(true)}
        pickerOpen={pickerOpen}
        setPickerOpen={setPickerOpen}
      />
    );
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
      {api.saveFailed && (
        <div className="save-alert" role="alert">
          This device would not save your last change. Free up some space, or export a backup now so nothing is lost.
        </div>
      )}
      {pendingFile.file && (
        <div className="toast update-toast" role="status">
          {pendingFile.file.name} is ready.
          <button type="button" className="btn btn-primary" onClick={pendingFile.save}>
            Save
          </button>
          <button type="button" className="btn btn-secondary" onClick={pendingFile.dismiss}>
            Not now
          </button>
        </div>
      )}
      {/* Updating reloads the page, so it waits until the coach is off the mat. */}
      {needRefresh && route.name !== 'run' && !pendingFile.file && (
        <div className="toast update-toast" role="status">
          A new version is ready.
          <button type="button" className="btn btn-primary" onClick={() => updateServiceWorker(true)}>
            Update
          </button>
        </div>
      )}
      {welcomeOpen && (
        <Welcome
          install={install}
          onClose={closeWelcome}
          onStart={() => {
            closeWelcome();
            navigate({ name: 'library' });
            setPickerOpen(true);
          }}
        />
      )}
    </>
  );
}
