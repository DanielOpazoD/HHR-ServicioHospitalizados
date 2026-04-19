import React from 'react';
import { MoveCopyModal } from '@/components/modals/actions/MoveCopyModal';
import { DischargeModal } from '@/components/modals/actions/DischargeModal';
import { TransferModal } from '@/components/modals/actions/TransferModal';
import type { CensusActionModalPropsModel } from '@/features/census/hooks/useCensusActionModalProps';

interface CensusActionModalsProps {
  actionModalProps: CensusActionModalPropsModel;
}

export const CensusActionModals: React.FC<CensusActionModalsProps> = ({ actionModalProps }) => (
  <>
    <MoveCopyModal {...actionModalProps.moveCopyProps} />
    <DischargeModal {...actionModalProps.dischargeProps} />
    <TransferModal {...actionModalProps.transferProps} />
  </>
);
