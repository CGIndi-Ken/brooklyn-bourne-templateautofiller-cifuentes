# Brooklyn Bourne Autofiller

The **Theme** menu offers four Standard themes and four Deluxe themes in Black and gold, Black and yellow, Grey and maroon, and Forest and mint. The previous Deluxe designs are now Standard; the original flat designs have been removed. Saved theme choices automatically use their matching Standard palette. Black and gold remains the default.

The new Deluxe tier adds subtle static patterns and gradients to backgrounds, headers and section headings. Product fields stay solid for readability. All themes synchronize across the popup, bulk editor, directory and on-page Autofiller, with no downloaded assets or continuous animation.

Bulk editing controls are centralized in **Apply to selected**. Expand **THC, tags & pricing** there for fill-blanks, per-field Apply/Clear, additive tags, and loading unfinished templates. The large Bulk updates banner has been removed. In the popup, first open **Shared edits & add products** to reach these tools.

## Faster product entry (0.23.0)

The popup and Bulk editor now share spreadsheet paste handling. Paste Name, optional Strain, and optional Description as tab-separated columns. A Name / Strain / Description header is optional. Quoted cells can contain tabs, line breaks and doubled quotes. The complete paste is validated before creating anything; invalid rows leave your input intact.

In Bulk editor, **Preview products** lists new names and counts duplicates. **Add products** rechecks the paste and skips names already in the workspace or saved templates (exact, case-sensitive matching). Saved products and existing edits are preserved. Use Load saved templates to edit existing products. Added products remain drafts; save them when ready. Product-specific descriptions and strains come only from their pasted row. Prices start blank and grams follow each name as before. Adding new entries clears the entry filter so the new products are visible.

The Load saved templates search now matches product/template names, vendor, brand, strain and category. Multiple words narrow the search together; checked choices survive changes to the search. **Select matches** checks the current results while keeping earlier selections. **Clear selection** unchecks all choices, including hidden results.

## Selective saving (0.22.0)

**Save selected (N)** saves changed entries that are checked and shown by the current search/filter. Unchecked and hidden edits remain in the draft. An unfinished entry outside that selection will not block the save. The count shows changed products eligible to save. **Save all templates** and **Ctrl+S** still save the entire batch. Both save actions retain conflict review and merge independent changes from other windows.

Extract the ZIP and open the folder in IntelliJ. To use in Chrome, open `chrome://extensions`, enable Developer mode, and choose Load unpacked with this folder. For an existing installation, update its files and click Reload, then reload Dutchie product tabs.

## Faster review and corrections (0.20.0)

In Bulk editor, use **Show** beside Search entries to find unsaved products or products missing THC, tags, cost, price, an online description, or required fields. **Missing THC, tags, cost or price** shows entries missing any of those four values. Filters combine with search, are remembered with the draft, and scope Select all and bulk updates to shown entries. Zero counts as a filled value. **Clear filters** restores the full batch. A product stays visible while you edit it; its filter result updates when you leave that product. These filters help organize work; they do not add requirements for saving or autofilling.

**Undo bulk update** reverses the last effective bulk Apply or Clear, including dependent category values and settings. A product edited afterward is kept intact; the remaining products can still be undone. A bulk action that changes nothing keeps the previous Undo available. Undo applies to the workspace draft and does not write saved templates. Save all templates to keep the result. Undo history is kept only in the current window until a successful save, Reload, conflict resolution, Remove all, or closing/reloading the workspace.

Press **Ctrl+S** (Mac: **⌘S**) to save in Templates or Bulk editor, including while typing in a field. Bulk editor still saves all edited entries, including hidden ones. Add product and Duplicate settings now open and focus the new Name field. If saving encounters an unnamed entry, duplicate name or an overlong description, it opens the affected entry and focuses the field to correct.

## Manual strain descriptions

1. Open the extension popup and select a template or create one.
2. Enter Name, for example `Product name | Runtz | 3.5g (H)`.
3. In Online description, click **Copy strain name + type**. This copies only text such as `Runtz (H)`. If copying is blocked, the text is selected so you can press Ctrl+C.
4. Paste into your **Dispensary Strain Descriptions** ChatGPT conversation and send it to use your established format.
5. Reopen the popup; your unfinished template is restored. Paste only the reviewed paragraph into Online description (maximum 2500 characters), name the template, and click **Save template**.
6. On a Dutchie product form, select the saved template and click **Fill all**. Online details is filled last: Name into Online title, then your description. Blank descriptions are skipped. The page returns to Details.

The extension does not contact ChatGPT or strain websites. Research and generation happen when you send the prompt yourself. Descriptions are saved with templates and included in Export templates / Import templates.

Drafts preserve unfinished work locally; click Save template before exporting or filling. New clears the current draft.

SKU generation waits for an enabled Generate button and allows up to eight seconds for a response, then retries once if the field is still blank. Existing SKUs are preserved. If generation still fails, check the panel's status and Dutchie's validation, then try Generate manually.

## Bulk template creation

The popup has **Templates**, **Bulk editor**, and **Brand directory** tabs. The original bulk creator now opens the new templates straight into Bulk editor, where each field shows **Changed**, **Kept**, or **Blank** compared with the starting shared settings. Open an entry's **Changes** tab for its full before/after comparison. A cleared/blank template field is skipped by autofill; it does not erase an existing value on Dutchie.

Use **Search entries** to find products by product/template name, vendor, brand, or strain. **Collapse all / Expand all** compact or restore the entire batch; each entry also has **Minimize / Expand**. Search and collapsed states are remembered in the workspace draft. While searching, Select all and shared edits affect only shown entries; Save all still saves all entries, including hidden ones.

In Bulk editor you can load existing saved templates, edit multiple products together, select entries and apply one field to them, or open the batch in a separate larger window. Each entry has its own **Details**, **Online description**, and **Changes** tabs. Descriptions are never copied to another new product automatically. **Save all templates** saves edited entries and preserves unrelated templates. Editing an existing product's Name keeps its original saved template key. A duplicate new template name is rejected.

Saving compares field values, so stored field order and missing blank/default fields cannot cause false conflicts. Independent edits merge automatically. If the same field has different edits in the saved template and your workspace, the other entries still save. That entry shows **Keep my edits** and **Use saved values**, with both versions visible. Either choice resolves only the conflicting values and keeps your other edits; click **Save all templates** to finish. Drafts retain unresolved edits across reloads. The separate **Reload** button deliberately discards that entry's local changes after confirmation; it is never required to resolve a save conflict.

Use **Brand directory** to save a vendor and multiple brands. Vendor name suggests learned Dutchie names, saved directory vendors, and vendors from templates. Selecting a saved vendor restores its pairings. Search brands and select several suggestions; selections remain as removable chips while you search. Use Arrow keys and Enter to select, Escape to close suggestions, or Backspace in an empty search to remove the last chip. You can also add a new exact brand name with Enter. Click **Save pairing** to remember changes, or use **Remember pairs from saved templates** to collect existing pairings.

To remove a saved vendor, select it in **Brand directory**, click **Delete vendor**, and confirm. This removes its directory pairings and keeps saved product templates. Learned suggestions and template values remain available; **Remember pairs from saved templates** can add those pairings again.

Saved templates and restored drafts keep their existing values. New templates start with blank cost and price; grams come from a recognized weight in the product name, otherwise remain blank.

The main template editor suggests that vendor's brands. Select a vendor and check its brands to create a separate bulk window with one starting entry per selected brand; use Add product or Duplicate settings for more. Shared settings from the template form carry into batches launched from the popup directory. Pairings are included in template exports and merged on import. Saved workspace drafts recover unfinished batches after reload.

Set the shared form values, then expand **Bulk template creation**. Paste one full product Name per line, click **Preview templates**, and then **Create templates**. Each line becomes a saved template named after the product. Existing template names and duplicate lines are skipped, preserving existing data.

You can also paste up to three tab-separated columns from a spreadsheet, with an optional header: **Name**, **Strain**, **Description**. Strain and description are blank unless supplied in that row. External ID is blank for each new template. Cost and base price start **blank** for new templates, including bulk creation, copies and new brand entries. Grams/concentration is inferred separately from each product name when a recognized weight is present. Other editable fields are shared from the form, including category, THC, vendor, brand, inventory settings, and the location-copy checkbox. Enter product-specific pricing and grams after creation. Review these shared settings before creating templates. Bulk input is remembered in the popup draft.

Type and Default unit are locked to **Quantity** in the editor. Full fills always apply Quantity regardless of old template values; each selection is verified and retried once if it does not stick. Any remaining failure appears in the fill status.

## Finish THC, tags and pricing later

Save a template with THC, tags, cost or base price blank when those details are not available. In **Bulk editor**, use **Load unfinished templates** to bring back saved templates missing any of these values. Existing workspace edits are kept.

In **Finish THC, tags & pricing**, enter the values you now have and choose multiple tags from the searchable dropdown. Tags use learned Dutchie options and tags in saved templates; learn them from the on-page **Lists** tab, or type an exact tag name and press Enter. Selected tags appear as removable chips.

Select the products to update, optionally search to narrow them, and use **Apply THC value only**, **Apply THC unit only**, **Apply cost only**, **Apply price only**, or **Add tags only**. Each button ignores the other inputs, even if they still contain values. **Apply all entered details** remains available for combined updates. Empty inputs leave existing values alone. By default THC, cost and price fill only blank fields; uncheck **Only fill blank THC, cost and price** to replace existing values. Choose **%** or **mg** alongside THC. Tags are added to existing tags without duplicates. To replace or clear tags instead, choose **Tags** in **Apply to selected**.

Each product also shows THC, THC unit, tags, cost and base price directly, so different values can be edited individually. Completion inputs and product edits are remembered as a local draft. Review the changes and click **Save all templates** before exporting or autofilling. Other template fields are preserved.

## Remember category pairings

A product category can remember its regulatory category and external category. Built-in pairings still apply until you remember a replacement. Category names match regardless of case and the `(New Category)` / `(New Categories)` suffix.

In **Bulk editor**, select the products, apply their regulatory and external categories using **Apply to selected**, then click **Remember category pairings from selected entries**. Only checked, shown entries supply pairings. Each category must have one consistent pairing; conflicting selections are rejected. Applying regulatory or external categories creates a per-template override so your chosen value is kept.

In the single-template editor, choose a category, unlock its presets to edit the pair, then click **Remember these category pairings**. Remembering saves the rule without changing saved product templates. New products and locked templates use the remembered rule automatically in the editors and during autofill. Unlocked templates keep their individual overrides. Pairings persist locally and are included in template exports/imports.

## Performance

The panel responds to product-form mounting and removal rather than polling while idle. Draft writes are grouped during typing and flushed when leaving the field or popup; unchanged drafts are not written again. Already-correct text fields are skipped to avoid unnecessary input events. Dropdown selection and SKU response waits retain their reliability checks.


## Development checks

The extension runs directly from these source files; no build or bundler is needed. Tests use Node.js, with Playwright and a Chrome/Chromium executable for browser checks. Run the full suite with:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright \
TEST_BROWSER_EXECUTABLE=/path/to/chromium \
node --test --test-concurrency=2 *.test.cjs
```

Use `PLAYWRIGHT_MODULE=playwright` when the package resolves normally. Alternatively, omit `TEST_BROWSER_EXECUTABLE` to use installed Chrome, or select a Playwright browser with `TEST_BROWSER_CHANNEL`. Browser fixtures run on a temporary local HTTP server with mocked extension storage; they do not contact Dutchie. After changes, reload the unpacked extension and verify autofill on the actual product form.

THC amount and THC unit (%/mg) have independent apply and clear buttons, as do cost and price. Clear empties only that field on checked, shown entries, even with fill-blanks enabled. Hidden and unchecked products are preserved. The selected count is shown above the controls, and actions are disabled when it is zero. Click **Save all templates** to persist clears.

Saved-template search starts as a compact, scrollable checklist. Use **Show full names** or **Condense all templates** to switch views; hover a shortened name to see it in full. Selections remain checked across searches. Loading selections closes the chooser and adds minimized product cards; expand only the products you want to edit.

The popup template chooser groups saved templates by their saved brand (or the name before the first `|`). Groups start condensed. Search across product names, strains, brands, vendors and categories; matching groups open automatically. Use A–Z/Z–A sorting, **Condense all** or **Expand all**, then select a template to close the chooser and load it. Long names show in full on hover. Names, copies and imported templates are preserved.

The on-page Autofiller now uses the same compact template chooser as the popup: collapsed brand groups, product/strain/vendor search, A–Z/Z–A sorting, and Condense all / Expand all. Selecting an entry updates the active autofill template and step list, then closes the chooser.

Use **Remove all** at the top of Bulk editor to start fresh. After confirmation, all workspace entries (including hidden/unchecked entries), shared settings, completion inputs and searches are cleared. Saved templates and vendor/category pairings are preserved. The empty draft stays empty after reopening; use Load last bulk batch to deliberately bring back previous work. NYS Distribution is excluded as a retired duplicate vendor from the directory and suggestions, including learned and imported choices; saved product data is preserved.

Strain fields in both editors offer a dropdown of learned Dutchie strains and strains from saved templates. Suggestions update when lists/templates change; exact manual strain names are also accepted.

Version 0.18 reduces repeated instructions across the popup, bulk editor and Autofiller. Guidance is available under expandable Help sections. Bulk Apply/Clear controls are grouped by field, summary counts are compact, and unchanged/blank field badges are hidden while changes and selection counts stay visible. All template, bulk editing, backup and autofill actions remain available.

## Weight from the product name

Use `BRAND | STRAIN | WEIGHT, QUANTITY, CATEGORY (TYPE)`. Only the size at the start of the final `|` section is read; quantity, category and strain type may follow it. `Florette | Zereal Milk | 3.5g (H)` sets grams/concentration to `3.5`. `Brand | Gummies | 100mg, 10pk, Edibles (H)` sets it to `0.1`. The stated weight is always the **total**: `1g 2pk` stays `1`, never `2`.

New templates and bulk-created entries infer their own weights. While automatic, editing Name updates grams too; removing a recognized size clears the previous inferred weight. Typing or clearing grams yourself makes it manual, including typing the same number. **From name** opts back into automatic weight. This choice is saved with templates and drafts and included in exports. Loading older saved templates or imports preserves their stored values; use From name to adopt a suggestion.

Only unambiguous g/mg sizes are recognized. Unformatted names, multiple dosage/weight values, multiplication expressions and unsupported units are left for manual entry. Cost and price are never inferred.
