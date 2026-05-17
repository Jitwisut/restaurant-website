UPDATE orders
   SET status = 'ready'
 WHERE status = 'done';

ALTER TABLE orders DROP CONSTRAINT IF EXISTS status_check;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
  CHECK (
    status IN (
      'pending',
      'accepted',
      'preparing',
      'ready',
      'completed',
      'cancelled',
      'rejected'
    )
  );
