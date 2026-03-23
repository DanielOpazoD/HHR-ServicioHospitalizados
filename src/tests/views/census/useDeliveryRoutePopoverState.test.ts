import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDeliveryRoutePopoverState } from '@/features/census/components/patient-row/useDeliveryRoutePopoverState';

describe('useDeliveryRoutePopoverState', () => {
  it('syncs draft from persisted props and saves normalized payload', () => {
    const onSave = vi.fn();
    const close = vi.fn();

    const { result, rerender } = renderHook(
      ({ route, date, cesareanLabor }) =>
        useDeliveryRoutePopoverState({
          deliveryRoute: route,
          deliveryDate: date,
          deliveryCesareanLabor: cesareanLabor,
          onSave,
        }),
      {
        initialProps: {
          route: undefined as 'Vaginal' | 'Cesárea' | undefined,
          date: undefined as string | undefined,
          cesareanLabor: undefined as 'Sin TdP' | 'Con TdP' | undefined,
        },
      }
    );

    expect(result.current.canSave).toBe(false);

    rerender({ route: 'Vaginal', date: '2026-02-14', cesareanLabor: undefined });
    expect(result.current.selectedRoute).toBe('Vaginal');
    expect(result.current.selectedDate).toBe('2026-02-14');
    expect(result.current.canSave).toBe(true);

    act(() => {
      result.current.setSelectedDate('   ');
    });
    act(() => {
      result.current.saveAndClose(close);
    });

    expect(onSave).toHaveBeenCalledWith('Vaginal', undefined, undefined);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('clears draft and persisted values', () => {
    const onSave = vi.fn();
    const close = vi.fn();

    const { result } = renderHook(() =>
      useDeliveryRoutePopoverState({
        deliveryRoute: 'Cesárea',
        deliveryDate: '2026-02-15',
        deliveryCesareanLabor: 'Con TdP',
        onSave,
      })
    );

    act(() => {
      result.current.clearAndClose(close);
    });

    expect(onSave).toHaveBeenCalledWith(undefined, undefined, undefined);
    expect(close).toHaveBeenCalledTimes(1);
    expect(result.current.selectedRoute).toBeUndefined();
    expect(result.current.selectedDate).toBe('');
    expect(result.current.selectedCesareanLabor).toBeUndefined();
  });
});
