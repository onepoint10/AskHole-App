import React, { useState, useEffect } from 'react';
import Joyride, { ACTIONS, EVENTS, STATUS } from 'react-joyride';
import { useTranslation } from 'react-i18next';

const AppTour = ({ isMobile }) => {
    const { t } = useTranslation();
    const [run, setRun] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);

    useEffect(() => {
        // Check if user has seen the tour
        const tourCompleted = localStorage.getItem('askhole-tour-completed');

        // Show tour automatically for first-time users after a short delay
        if (!tourCompleted) {
            const timer = setTimeout(() => {
                setRun(true);
            }, 1000);

            return () => clearTimeout(timer);
        }
    }, []);

    const handleJoyrideCallback = (data) => {
        const { action, index, status, type } = data;

        if ([EVENTS.STEP_AFTER, EVENTS.TARGET_NOT_FOUND].includes(type)) {
            // Update state to advance the tour
            setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1));
        } else if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
            // Mark tour as completed
            localStorage.setItem('askhole-tour-completed', 'true');
            setRun(false);
            setStepIndex(0);
        }
    };

    // Define steps based on device type
    const getSteps = () => {
        const commonSteps = [
            {
                target: 'body',
                content: (
                    <div>
                        <h2 className="text-xl font-bold mb-2">{t('welcome_to_askhole')}</h2>
                        <p>{t('tour_intro')}</p>
                    </div>
                ),
                placement: 'center',
                disableBeacon: true,
            },
        ];

        const mobileSteps = [
            {
                target: '.mobile-sidebar-toggle',
                content: (
                    <div>
                        <h3 className="text-lg font-semibold mb-2">{t('tour_mobile_sidebar_title')}</h3>
                        <p>{t('tour_mobile_sidebar')}</p>
                    </div>
                ),
                disableBeacon: true,
            },
            {
                target: '.mobile-sidebar-toggle',
                content: (
                    <div>
                        <h3 className="text-lg font-semibold mb-2">{t('tour_sidebar_tabs_title')}</h3>
                        <ul className="space-y-2 text-sm">
                            <li>• <strong>{t('history')}</strong>: {t('tour_sidebar_history_tab')}</li>
                            <li>• <strong>{t('prompts')}</strong>: {t('tour_sidebar_prompts_tab')}</li>
                            <li>• <strong>{t('public')}</strong>: {t('tour_sidebar_public_tab')}</li>
                        </ul>
                    </div>
                ),
                disableBeacon: true,
            },
            {
                target: '.mobile-newchat-button',
                content: t('tour_new_chat'),
                disableBeacon: true,
            },
        ];

        const desktopSteps = [
            {
                target: '.sidebar',
                content: (
                    <div>
                        <h3 className="text-lg font-semibold mb-2">{t('tour_sidebar_title')}</h3>
                        <p className="mb-2">{t('tour_sidebar')}</p>
                    </div>
                ),
                disableBeacon: true,
            },
            {
                target: '.sidebar',
                content: (
                    <div>
                        <h3 className="text-lg font-semibold mb-2">{t('tour_sidebar_tabs_title')}</h3>
                        <ul className="space-y-2 text-sm">
                            <li>• <strong>{t('history')}</strong>: {t('tour_sidebar_history_tab')}</li>
                            <li>• <strong>{t('prompts')}</strong>: {t('tour_sidebar_prompts_tab')}</li>
                            <li>• <strong>{t('public')}</strong>: {t('tour_sidebar_public_tab')}</li>
                        </ul>
                    </div>
                ),
                disableBeacon: true,
            },
        ];

        const messageSteps = [
            {
                target: '.message-input-container',
                content: t('tour_message_input'),
                disableBeacon: true,
            },
            {
                target: '.model-selector-trigger',
                content: t('tour_model_selector'),
                disableBeacon: true,
            },
            {
                target: '.message-list',
                content: t('tour_message_list'),
                disableBeacon: true,
            },
            {
                target: 'body',
                content: (
                    <div>
                        <h2 className="text-xl font-bold mb-2">{t('tour_complete_title')}</h2>
                        <p>{t('tour_complete_message')}</p>
                    </div>
                ),
                placement: 'center',
                disableBeacon: true,
            },
        ];

        return [
            ...commonSteps,
            ...(isMobile ? mobileSteps : desktopSteps),
            ...messageSteps,
        ];
    };

    return (
        <Joyride
            callback={handleJoyrideCallback}
            continuous
            run={run}
            scrollToFirstStep
            showProgress
            showSkipButton
            stepIndex={stepIndex}
            steps={getSteps()}
            styles={{
                options: {
                    arrowColor: 'rgba(100, 100, 100, 0.95)',
                    backgroundColor: 'rgba(100, 100, 100, 0.95)',
                    overlayColor: 'rgba(0, 0, 0, 0.5)',
                    primaryColor: 'hsl(var(--primary))',
                    textColor: '#ffffff',
                    width: 380,
                    zIndex: 10000,
                    beaconSize: 36,
                },
                beacon: {
                    borderRadius: '50%',
                },
                beaconInner: {
                    backgroundColor: 'hsl(var(--primary))',
                },
                beaconOuter: {
                    backgroundColor: 'hsl(var(--primary) / 0.2)',
                    border: '2px solid hsl(var(--primary))',
                },
                tooltip: {
                    borderRadius: '0.5rem',
                    padding: '1.25rem',
                    backgroundColor: 'rgba(100, 100, 100, 0.95)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)', // Safari support
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                },
                tooltipContainer: {
                    textAlign: 'left',
                },
                tooltipTitle: {
                    fontSize: '1.125rem',
                    fontWeight: '600',
                    marginBottom: '0.5rem',
                    color: '#ffffff',
                },
                tooltipContent: {
                    fontSize: '0.875rem',
                    lineHeight: '1.5',
                    padding: '0.5rem 0',
                    color: '#ffffff',
                },
                buttonNext: {
                    backgroundColor: 'hsl(var(--primary))',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    padding: '0.5rem 1rem',
                    color: '#ffffff',
                    fontWeight: '500',
                },
                buttonBack: {
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontSize: '0.875rem',
                    marginRight: '0.5rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '0.375rem',
                    padding: '0.5rem 1rem',
                    fontWeight: '500',
                },
                buttonSkip: {
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '0.875rem',
                },
            }}
            locale={{
                back: t('back'),
                close: t('close'),
                last: t('finish'),
                next: t('next'),
                open: t('open'),
                skip: t('skip'),
            }}
        />
    );
};

export default AppTour;
