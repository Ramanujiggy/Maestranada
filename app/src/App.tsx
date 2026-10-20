import { Fragment, useCallback, useState } from 'react';
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
import { t, useLang } from './lib/i18n.ts';

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
        <h1 className="card-title">{t('notFoundTitle')}</h1>
        <p className="muted" style={{ margin: 0 }}>
          {t('notFoundBody')}
        </p>
        <button type="button" className="btn btn-primary" onClick={() => navigate({ name: 'library' })}>
          {t('backToClasses')}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  // Switching language redraws every screen from scratch in the new one.
  const lang = useLang();
  return (
    <Fragment key={lang}>
      <Screens />
    </Fragment>
  );
}

function Screens() {
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
          {t('saveFailed')}
        </div>
      )}
      {pendingFile.file && (
        <div className="toast update-toast" role="status">
          {t('fileReady', { name: pendingFile.file.name })}
          <button type="button" className="btn btn-primary" onClick={pendingFile.save}>
            {t('save')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={pendingFile.dismiss}>
            {t('notNow')}
          </button>
        </div>
      )}
      {/* Updating reloads the page, so it waits until the coach is off the mat. */}
      {needRefresh && route.name !== 'run' && !pendingFile.file && (
        <div className="toast update-toast" role="status">
          {t('newVersion')}
          <button type="button" className="btn btn-primary" onClick={() => updateServiceWorker(true)}>
            {t('update')}
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
