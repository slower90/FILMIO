# MAD MAX — SEO Setup (copy-paste ready)

Replit Agent ko ye file dikha ke bol sakte ho: "Add these to my app exactly as written."

---

## 1. Meta Tags (har page ke `<head>` mein)

Agar Flask + Jinja templates use ho rahe hain, `templates/base.html` ke `<head>` mein ye daalo:

```html
<title>{{ page_title or "MAD MAX - Movie Reviews & Ratings" }}</title>
<meta name="description" content="{{ page_description or 'Read and write movie reviews, ratings, and connect with actors on MAD MAX.' }}">
<meta property="og:title" content="{{ page_title or 'MAD MAX' }}">
<meta property="og:description" content="{{ page_description or 'Movie reviews, ratings, actor networking.' }}">
<meta property="og:type" content="website">
<meta property="og:image" content="{{ page_image or url_for('static', filename='og-default.jpg', _external=True) }}">
<meta name="twitter:card" content="summary_large_image">
<meta name="robots" content="index, follow">
<link rel="canonical" href="{{ request.url }}">
```

Har movie page render karte waqt `page_title` aur `page_description` us movie ke naam/summary se fill karna — yehi Google search result mein dikhega.

---

## 2. Review Schema (Google pe stars dikhane ke liye)

Har movie review page ke `<head>` mein, movie ke actual data se ye JSON-LD daalo:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Movie",
  "name": "{{ movie.title }}",
  "image": "{{ movie.poster_url }}",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "{{ movie.avg_rating }}",
    "bestRating": "10",
    "ratingCount": "{{ movie.review_count }}"
  },
  "review": [
    {
      "@type": "Review",
      "author": {
        "@type": "Person",
        "name": "{{ review.author_name }}"
      },
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": "{{ review.rating }}",
        "bestRating": "10"
      },
      "reviewBody": "{{ review.text }}"
    }
  ]
}
</script>
```

Flask route mein ye values (`movie.avg_rating`, `movie.review_count`, etc.) database se pull karke template ko bhejni hongi — agent ko keh do "movie object se ye fields template ko pass karo."

**Zaroori**: kam se kam 3-5 reviews ho tabhi Google isko valid samajhta hai. Sirf 1 review pe rich snippet kabhi nahi dikhega.

---

## 3. sitemap.xml (auto-generate)

Flask route add karo jo dynamically sab movie pages list kare:

```python
from flask import Response

@app.route('/sitemap.xml')
def sitemap():
    pages = []
    # Static pages
    pages.append({'loc': 'https://yourdomain.in/', 'priority': '1.0'})
    pages.append({'loc': 'https://yourdomain.in/movies', 'priority': '0.9'})

    # Dynamic movie pages — apne movies table se loop karo
    movies = Movie.query.all()  # apne model ke hisaab se adjust karo
    for movie in movies:
        pages.append({'loc': f'https://yourdomain.in/movie/{movie.id}', 'priority': '0.8'})

    xml = ['<?xml version="1.0" encoding="UTF-8"?>']
    xml.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    for page in pages:
        xml.append(f"<url><loc>{page['loc']}</loc><priority>{page['priority']}</priority></url>")
    xml.append('</urlset>')

    return Response('\n'.join(xml), mimetype='application/xml')
```

Domain finalize hone ke baad `yourdomain.in` ko actual domain se replace karna.

---

## 4. robots.txt

`static/robots.txt` (ya root route) mein:

```
User-agent: *
Allow: /
Sitemap: https://yourdomain.in/sitemap.xml
```

---

## 5. Google Search Console setup (site ready hone ke baad)

1. https://search.google.com/search-console pe jao
2. Domain add karo, HTML tag verification method choose karo
3. Jo `<meta name="google-site-verification" content="...">` tag milega, usko `base.html` ke `<head>` mein paste karo
4. Verify karne ke baad, sitemap URL (`https://yourdomain.in/sitemap.xml`) submit karo Search Console mein

Isse Google ko pata chalega site exist karti hai aur crawl karna shuru karega — bina iske indexing mein hafton lag sakte hain.

---

## Order of operations
1. Domain finalize + connect karo
2. Meta tags + schema pehle add karo (development ke saath saath)
3. Launch se pehle sitemap.xml aur robots.txt live check karo
4. Launch ke din hi Search Console verify + sitemap submit karo
