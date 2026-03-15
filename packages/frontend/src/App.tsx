import { Routes, Route, Link } from 'react-router-dom';
import HomePage from './pages/HomePage';
import AnalysisPage from './pages/AnalysisPage';
import DependencyDetailPage from './pages/DependencyDetailPage';

function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center space-x-2">
              <span className="text-2xl font-bold text-indigo-600">
                LicenseScope
              </span>
            </Link>
            <nav className="flex items-center space-x-4">
              <Link
                to="/"
                className="text-slate-600 hover:text-indigo-600 font-medium text-sm"
              >
                Home
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/analysis/:id" element={<AnalysisPage />} />
          <Route
            path="/analysis/:id/dependency/:depId"
            element={<DependencyDetailPage />}
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;
