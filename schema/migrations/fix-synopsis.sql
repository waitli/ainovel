-- Populate synopsis from submission_data
UPDATE books SET synopsis = 
  CASE 
    WHEN json_extract(submission_data, '$.worldview') IS NOT NULL 
      THEN json_extract(submission_data, '$.worldview') || ' ' || COALESCE(json_extract(submission_data, '$.outline'), '')
    ELSE synopsis
  END
WHERE synopsis IS NULL OR synopsis = '';
