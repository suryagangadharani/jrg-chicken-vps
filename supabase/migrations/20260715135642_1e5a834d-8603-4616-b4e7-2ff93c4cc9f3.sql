
-- Lock down SECURITY DEFINER helpers
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- Storage RLS: anyone can view product images, only admins can write
create policy "public read product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "admin upload product images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images' and public.has_role(auth.uid(), 'admin'));

create policy "admin update product images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images' and public.has_role(auth.uid(), 'admin'));

create policy "admin delete product images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and public.has_role(auth.uid(), 'admin'));
