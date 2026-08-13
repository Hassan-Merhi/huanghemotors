INSERT INTO models(slug,name,description_en,description_fr,availability,published,sort_order,updated_at) VALUES
('site-home-hero','Website Photo · Homepage Hero','Internal website photo slot.','Emplacement photo interne du site.','inquire',0,9001,NOW()),
('site-heritage-main','Website Photo · Heritage Large','Internal website photo slot.','Emplacement photo interne du site.','inquire',0,9002,NOW()),
('site-heritage-side','Website Photo · Heritage Side','Internal website photo slot.','Emplacement photo interne du site.','inquire',0,9003,NOW()),
('site-dealership-showroom','Website Photo · Dealership Showroom','Internal website photo slot.','Emplacement photo interne du site.','inquire',0,9004,NOW())
ON CONFLICT(slug) DO NOTHING;
