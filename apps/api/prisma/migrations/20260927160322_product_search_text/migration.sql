-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "searchText" TEXT NOT NULL DEFAULT '';


-- Backfill existing rows until the next catalog sync recomputes the column with normalizeSearch().
UPDATE "Product" SET "searchText" = trim(regexp_replace(
  translate(lower("brand" || ' ' || "name" || ' ' || "slug"),
            'áàâäãåéèêëíìîïóòôöõúùûüçčćšžđñ', 'aaaaaaeeeeiiiiooooouuuucccszdn'),
  '[^a-z0-9]+', ' ', 'g'));
