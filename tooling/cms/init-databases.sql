-- One database per api app, plus a *_test database for its integration tests.
-- This file only runs when the volume is first created. For an app added later, run:
--   docker exec ld-mobile-postgres createdb -U payload <name> && docker exec ld-mobile-postgres createdb -U payload <name>_test
CREATE DATABASE template;
CREATE DATABASE template_test;
CREATE DATABASE pixel_pitch;
CREATE DATABASE pixel_pitch_test;
