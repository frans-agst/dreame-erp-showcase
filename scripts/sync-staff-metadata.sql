-- Sync Staff Store Assignments to Auth Metadata
-- This script manually syncs the staff_stores table data to auth.users metadata
-- Run this when the store selector is not showing for multi-store staff

DO $$
DECLARE
  staff_record RECORD;
  store_ids_array UUID[];
  primary_store_id UUID;
  store_ids_json TEXT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== SYNCING STAFF METADATA ===';
  RAISE NOTICE '';
  
  -- Loop through all active staff with store assignments
  FOR staff_record IN 
    SELECT DISTINCT
      p.id,
      p.email,
      p.full_name
    FROM profiles p
    JOIN staff_stores ss ON ss.staff_id = p.id
    WHERE p.role IN ('staff', 'manager')
      AND p.is_active = true
  LOOP
    -- Get assigned store IDs for this staff member
    SELECT ARRAY_AGG(store_id ORDER BY is_primary DESC, store_id)
    INTO store_ids_array
    FROM staff_stores
    WHERE staff_id = staff_record.id;
    
    -- Get primary store ID
    SELECT store_id
    INTO primary_store_id
    FROM staff_stores
    WHERE staff_id = staff_record.id
      AND is_primary = true
    LIMIT 1;
    
    -- If no primary store, use the first one
    IF primary_store_id IS NULL AND array_length(store_ids_array, 1) > 0 THEN
      primary_store_id := store_ids_array[1];
    END IF;
    
    -- Convert array to JSON format for metadata
    store_ids_json := array_to_json(store_ids_array)::text;
    
    -- Update auth.users metadata
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
          jsonb_set(
            jsonb_set(
              COALESCE(raw_user_meta_data, '{}'::jsonb),
              '{assigned_store_ids}',
              store_ids_json::jsonb
            ),
            '{primary_store_id}',
            to_jsonb(primary_store_id::text)
          ),
          '{current_store_id}',
          to_jsonb(primary_store_id::text)
        )
    WHERE id = staff_record.id;
    
    RAISE NOTICE 'Synced: % (%) - % stores, primary: %', 
      staff_record.full_name, 
      staff_record.email,
      array_length(store_ids_array, 1),
      primary_store_id;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '=== SYNC COMPLETE ===';
  RAISE NOTICE 'Staff members should now see the store selector after refreshing the page.';
  RAISE NOTICE '';
END $$;

-- Verify the sync
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== VERIFICATION ===';
  RAISE NOTICE 'Checking synced metadata:';
  RAISE NOTICE '';
END $$;

SELECT 
  u.email,
  u.raw_user_meta_data->>'full_name' as full_name,
  u.raw_user_meta_data->>'assigned_store_ids' as assigned_store_ids,
  u.raw_user_meta_data->>'primary_store_id' as primary_store_id,
  u.raw_user_meta_data->>'current_store_id' as current_store_id,
  (
    SELECT COUNT(*)
    FROM staff_stores ss
    WHERE ss.staff_id = u.id
  ) as db_store_count
FROM auth.users u
WHERE u.raw_app_meta_data->>'role' IN ('staff', 'manager')
ORDER BY u.email;
