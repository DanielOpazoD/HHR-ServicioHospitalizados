import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DualSpecialtyCell } from '@/features/census/components/patient-row/DualSpecialtyCell';
import { createEmptyPatient } from '@/services/factories/patientFactory';

const StatefulDualSpecialtyCell: React.FC<{
  initialData?: ReturnType<typeof createEmptyPatient>;
  onMultipleUpdate: (fields: Partial<ReturnType<typeof createEmptyPatient>>) => void;
}> = ({ initialData = createEmptyPatient('R1'), onMultipleUpdate }) => {
  const [data, setData] = React.useState(initialData);
  const onChange = vi.fn(() => vi.fn());

  return (
    <table>
      <tbody>
        <tr>
          <DualSpecialtyCell
            data={data}
            onChange={onChange as never}
            onMultipleUpdate={fields => {
              onMultipleUpdate(fields);
              setData(current => ({ ...current, ...fields }));
            }}
          />
        </tr>
      </tbody>
    </table>
  );
};

const renderCell = () => {
  const onMultipleUpdate = vi.fn();

  const view = render(<StatefulDualSpecialtyCell onMultipleUpdate={onMultipleUpdate} />);

  return {
    ...view,
    onMultipleUpdate,
  };
};

describe('DualSpecialtyCell', () => {
  it('opens subtype selector when choosing Ginecobstetricia', async () => {
    const { container, onMultipleUpdate } = renderCell();
    const select = container.querySelector('select');

    if (!select) {
      throw new Error('Specialty select not found');
    }

    fireEvent.change(select, { target: { value: 'Ginecobstetricia' } });

    expect(onMultipleUpdate).toHaveBeenCalledWith({ specialty: 'Ginecobstetricia' });
    expect(await screen.findByRole('button', { name: 'Obstétrica' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Obstétrica' }));

    expect(onMultipleUpdate).toHaveBeenLastCalledWith({ ginecobstetriciaType: 'Obstétrica' });
  });

  it('clears obstetric delivery fields when switching to Ginecológica', async () => {
    const onMultipleUpdate = vi.fn();
    const onChange = vi.fn(() => vi.fn());
    const data = {
      ...createEmptyPatient('R1'),
      specialty: 'Ginecobstetricia' as never,
      ginecobstetriciaType: 'Obstétrica' as const,
      deliveryRoute: 'Cesárea' as const,
      deliveryDate: '2026-03-22',
      deliveryCesareanLabor: 'Con TdP' as const,
    };

    render(
      <table>
        <tbody>
          <tr>
            <DualSpecialtyCell
              data={data}
              onChange={onChange as never}
              onMultipleUpdate={onMultipleUpdate}
            />
          </tr>
        </tbody>
      </table>
    );

    fireEvent.click(screen.getByTitle('Definir tipo de atención'));
    fireEvent.click(await screen.findByRole('button', { name: 'Ginecológica' }));

    expect(onMultipleUpdate).toHaveBeenLastCalledWith({
      ginecobstetriciaType: 'Ginecológica',
      deliveryRoute: undefined,
      deliveryDate: undefined,
      deliveryCesareanLabor: undefined,
    });
  });
});
