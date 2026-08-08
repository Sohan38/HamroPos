# Purchase price logic follow-up

## Future work
- Review what happens when a purchase unit cost changes after the item already exists in inventory.
- Decide whether the inventory purchase rate should update, remain unchanged, or be recalculated from history.
- Check how supplier-specific costs and variant-level costs should behave when the purchase price changes.
- Confirm whether existing batches should inherit the old cost, the new cost, or a weighted average.
- Add a clear policy for partial receipts, price overrides, and editing historical purchases.

## Current scope
- Added validation for expiry-tracked batches in the purchase form.
- Added an inline warning when the unit cost is changed from the original value.
