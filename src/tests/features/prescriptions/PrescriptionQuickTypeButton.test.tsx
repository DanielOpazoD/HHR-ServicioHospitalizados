import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PrescriptionQuickTypeButton } from '@/features/prescriptions/components/PrescriptionQuickTypeButton';

describe('PrescriptionQuickTypeButton', () => {
  it('renders the type menu as a foreground overlay outside the clipped parent', () => {
    const onChange = vi.fn(async () => undefined);
    render(
      <div data-testid="clipped-parent" className="h-10 overflow-auto">
        <PrescriptionQuickTypeButton currentType="comun" onChange={onChange} variant="inline" />
      </div>
    );

    fireEvent.click(screen.getByRole('button', { name: /común/i }));

    const menu = screen.getByRole('menu');
    expect(menu.parentElement).toBe(document.body);
    expect(menu).toHaveClass('fixed');
  });
});
