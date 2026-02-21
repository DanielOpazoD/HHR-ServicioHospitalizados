import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RutPassportInput } from '@/features/census/components/patient-row/RutPassportInput';

const renderComponent = (props?: Partial<React.ComponentProps<typeof RutPassportInput>>) =>
  render(
    <table>
      <tbody>
        <tr>
          <RutPassportInput value="" documentType="RUT" onChange={vi.fn()} {...props} />
        </tr>
      </tbody>
    </table>
  );

describe('RutPassportInput', () => {
  it('auto-fills "-" and locks input for RN in clinical crib context', async () => {
    const onChange = vi.fn();
    renderComponent({
      value: '',
      onChange,
      isClinicalCribPatient: true,
    });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('-'));
  });

  it('shows hidden hover action to unlock RUT placeholder', () => {
    const onChange = vi.fn();
    renderComponent({
      value: '-',
      onChange,
      isClinicalCribPatient: true,
    });

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input).toBeDisabled();
    expect(input.value).toBe('');
    expect(screen.queryByTitle('Cambiar a Pasaporte')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Editar RUT RN'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('keeps RN RUT editable after unlock (does not re-apply placeholder immediately)', async () => {
    const StatefulHarness: React.FC = () => {
      const [rut, setRut] = React.useState('-');
      return (
        <table>
          <tbody>
            <tr>
              <RutPassportInput
                value={rut}
                documentType="RUT"
                onChange={setRut}
                isClinicalCribPatient
              />
            </tr>
          </tbody>
        </table>
      );
    };

    render(<StatefulHarness />);
    fireEvent.click(screen.getByLabelText('Editar RUT RN'));

    await waitFor(() => {
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input).not.toBeDisabled();
      expect(input.value).toBe('');
    });
  });
});
