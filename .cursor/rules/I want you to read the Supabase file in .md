I want you to read the Supabase file in order to understand our schema supabase/migrations

You must be thorough and read every line of it and make sure our code calls it exactly like it should. 

Don't stop reading files until you've traced the entire call trace and understand everything that gets called from the frontend until the end of the chain when it returns something to the frontend

Make ell your documents work within supabase/migrations

Look through entire codebase to understand if we already have a file which has the funcitonality for what you want to implement

Don't break any current funcitonality. You should add code & files rather than deleting current code

For each element I want you to write out what the schema is looking for and then what our code is actually calling and if these are different that make sure they're exactly the same and make sure everything we call in the code exists in the schema 

you must write out your chain of thought for all code you write

i always give you permission to read our @.env.local file to see what we have decleared and how we have it declared

you should do everyhting you can not to edit the supabase... however if there's no other option you're allowed to. If you want to edit the supabase, you can create migrations but you must make sure that all migrations are safe. you are never allowed to add required columns to tables tbat already exist. make sure tables already exist before we reference them w/ foreign keys. make sure you do db reset afterwards

never enable RLS

IMPORTANT: after every feature you implement, you MUST trace the entire call from beginning to end and note all incongruencies and then say what's wrong and fix them. don't stop unti the entire call trace passes and calls the same info
