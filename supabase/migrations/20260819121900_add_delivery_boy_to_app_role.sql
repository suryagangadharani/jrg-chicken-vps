-- Migration: Add 'delivery_boy' to app_role ENUM type
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'delivery_boy';
