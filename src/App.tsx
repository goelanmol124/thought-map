import { useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { InquiryWorkspace } from './components/InquiryWorkspace';
import { useInquiries } from './hooks/useInquiries';

function App() {
    const {
        inquiryList,
        activeInquiryId,
        activeInquiry,
        focusedQuestionId,
        isDarkMode,
        actions,
    } = useInquiries();
    const {
        createInquiry,
        deleteInquiry,
        openInquiry,
        updateInquiry,
        selectQuestion,
        updateQuestion,
        resolveQuestion,
        addEvidence,
        removeEvidence,
        deleteQuestion,
        updateSynthesis,
        captureSnapshot,
        importInquiry,
        toggleTheme,
    } = actions;

    useEffect(() => {
        if (isDarkMode) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
    }, [isDarkMode]);

    useEffect(() => {
        if (activeInquiryId && !activeInquiry) {
            openInquiry(null);
        }
    }, [activeInquiryId, activeInquiry, openInquiry]);

    if (!activeInquiry) {
        return (
            <Dashboard
                inquiries={inquiryList}
                isDarkMode={isDarkMode}
                onCreate={createInquiry}
                onOpen={(inquiryId) => openInquiry(inquiryId)}
                onDelete={deleteInquiry}
                onImport={importInquiry}
                onToggleTheme={toggleTheme}
            />
        );
    }

    return (
        <InquiryWorkspace
            inquiry={activeInquiry}
            focusedQuestionId={focusedQuestionId}
            isDarkMode={isDarkMode}
            onHome={() => openInquiry(null)}
            onToggleTheme={toggleTheme}
            onSelectQuestion={(questionId) => selectQuestion(activeInquiry.id, questionId)}
            onUpdateInquiry={(patch) => updateInquiry(activeInquiry.id, patch)}
            onUpdateQuestion={(questionId, patch) => updateQuestion(activeInquiry.id, questionId, patch)}
            onResolveQuestion={(questionId, answer, stance, followUps) =>
                resolveQuestion(activeInquiry.id, questionId, answer, stance, followUps)}
            onAddEvidence={(questionId, draft) => addEvidence(activeInquiry.id, questionId, draft)}
            onRemoveEvidence={(questionId, evidenceId) =>
                removeEvidence(activeInquiry.id, questionId, evidenceId)}
            onDeleteQuestion={(questionId) => deleteQuestion(activeInquiry.id, questionId)}
            onUpdateSynthesis={(synthesis) => updateSynthesis(activeInquiry.id, synthesis)}
            onCaptureSnapshot={() => captureSnapshot(activeInquiry.id)}
        />
    );
}

export default App;
