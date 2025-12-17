import { useState } from 'react';
import { ArrowLeft, Database } from 'lucide-react';
import { CreateRunForm } from './components/CreateRunForm';
import { RunsTable } from './components/RunsTable';
import { ResultsTable } from './components/ResultsTable';
import {
  useScrapingRuns,
  useScrapingResults,
  useCreateRun,
  useAbortRun,
} from './hooks/useScrapingRuns';
import { scrapingApi } from './api/client';

function App() {
  const [runsPage, setRunsPage] = useState(1);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [resultsPage, setResultsPage] = useState(1);

  // Queries
  const { data: runsData, isLoading: runsLoading, refetch: refetchRuns } = useScrapingRuns(runsPage);
  const { data: resultsData, isLoading: resultsLoading } = useScrapingResults(
    selectedRunId,
    resultsPage
  );

  // Mutations
  const createRun = useCreateRun();
  const abortRun = useAbortRun();

  const handleViewResults = (runId: number) => {
    setSelectedRunId(runId);
    setResultsPage(1);
  };

  const handleBack = () => {
    setSelectedRunId(null);
    setResultsPage(1);
  };

  const handleRefreshStatus = async (runId: number) => {
    try {
      await scrapingApi.checkStatus(runId);
      refetchRuns();
    } catch (error) {
      console.error('Failed to refresh status:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <Database className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Intent2Reach</h1>
              <p className="text-sm text-gray-500">LinkedIn Scraping Dashboard</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {selectedRunId ? (
          // Results View
          <div className="space-y-6">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to runs
            </button>

            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Results for Run #{selectedRunId}
              </h2>
              {resultsData && (
                <span className="text-sm text-gray-500">
                  {resultsData.total} total results
                </span>
              )}
            </div>

            {resultsLoading ? (
              <div className="card text-center py-12">
                <p className="text-gray-500">Loading results...</p>
              </div>
            ) : resultsData ? (
              <ResultsTable
                results={resultsData.results}
                total={resultsData.total}
                page={resultsPage}
                pageSize={resultsData.page_size}
                onPageChange={setResultsPage}
              />
            ) : null}
          </div>
        ) : (
          // Main Dashboard
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Create Run Form */}
            <div className="lg:col-span-1">
              <CreateRunForm
                onSubmit={(params) => createRun.mutate(params)}
                isLoading={createRun.isPending}
              />
            </div>

            {/* Runs List */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Scraping Runs</h2>
                {runsData && (
                  <span className="text-sm text-gray-500">
                    {runsData.total} total runs
                  </span>
                )}
              </div>

              {runsLoading ? (
                <div className="card text-center py-12">
                  <p className="text-gray-500">Loading runs...</p>
                </div>
              ) : runsData ? (
                <>
                  <RunsTable
                    runs={runsData.runs}
                    onViewResults={handleViewResults}
                    onAbort={(runId) => abortRun.mutate(runId)}
                    onRefresh={handleRefreshStatus}
                    isAborting={abortRun.isPending}
                  />

                  {/* Pagination */}
                  {runsData.total > runsData.page_size && (
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => setRunsPage((p) => Math.max(1, p - 1))}
                        disabled={runsPage <= 1}
                        className="btn btn-secondary text-sm disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="flex items-center px-3 text-sm text-gray-600">
                        Page {runsPage}
                      </span>
                      <button
                        onClick={() => setRunsPage((p) => p + 1)}
                        disabled={runsPage * runsData.page_size >= runsData.total}
                        className="btn btn-secondary text-sm disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-sm text-gray-500 text-center">
            Intent2Reach - LinkedIn Intelligence Platform
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
