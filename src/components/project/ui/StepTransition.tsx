'use client';

import React, { useEffect, useState, useRef } from 'react';

interface StepTransitionProps {
  children: React.ReactNode;
  stepKey: string; // Unique key for current step to detect changes
}

export default function StepTransition({ children, stepKey }: StepTransitionProps) {
  const [displayedStep, setDisplayedStep] = useState(stepKey);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const previousStepRef = useRef(stepKey);
  const contentRef = useRef<HTMLDivElement>(null);

  const stepOrder = ['input', 'storyboard', 'production'];

  useEffect(() => {
    if (stepKey !== previousStepRef.current) {
      const prevIndex = stepOrder.indexOf(previousStepRef.current);
      const newIndex = stepOrder.indexOf(stepKey);
      setDirection(newIndex > prevIndex ? 'forward' : 'backward');
      setIsTransitioning(true);

      // After exit animation
      const exitTimer = setTimeout(() => {
        setDisplayedStep(stepKey);
        previousStepRef.current = stepKey;

        // After enter animation
        const enterTimer = setTimeout(() => {
          setIsTransitioning(false);
        }, 300);

        return () => clearTimeout(enterTimer);
      }, 150);

      return () => clearTimeout(exitTimer);
    }
  }, [stepKey]);

  const getTransitionClasses = () => {
    if (!isTransitioning) return 'opacity-100 translate-x-0';

    if (displayedStep !== stepKey) {
      // Exiting
      return direction === 'forward'
        ? 'opacity-0 -translate-x-4'
        : 'opacity-0 translate-x-4';
    } else {
      // Entering
      return direction === 'forward'
        ? 'opacity-0 translate-x-4'
        : 'opacity-0 -translate-x-4';
    }
  };

  return (
    <div
      ref={contentRef}
      className={`transition-all duration-300 ease-out ${getTransitionClasses()}`}
    >
      {children}
    </div>
  );
}
