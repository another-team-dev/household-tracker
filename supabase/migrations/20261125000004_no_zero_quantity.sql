-- NOT APPLIED YET: deletes rows, so it waits for Antonina's go-ahead.
-- An item with nothing left is removed by the app, so zero is no longer a valid quantity.
-- Until this runs, the app simply hides items whose quantity is 0.
delete from public.items where quantity = 0;
alter table public.items drop constraint items_quantity_check;
alter table public.items add constraint items_quantity_check check (quantity > 0);
