async function inspect() {
  const base = 'http://localhost:5000/api';
  const docsRes = await fetch(base + '/knowledge/documents?limit=3').then((r) => r.json());

  console.log(`Inspecting ${docsRes.documents.length} sample documents:`);

  for (const doc of docsRes.documents) {
    console.log('\n======================================================');
    console.log('Document ID:   ', doc._id);
    console.log('Title:         ', doc.title);
    console.log('URL:           ', doc.sourceUrl);
    console.log('Org/Author:    ', doc.metadata?.organization, '/', (doc.metadata?.authors || []).join(', '));
    console.log('Year:          ', doc.metadata?.year);
    console.log('Topics:        ', doc.metadata?.topics);
    console.log('Variables:     ', doc.metadata?.variables);

    // Fetch via GET /api/sources/:id
    const sourceRes = await fetch(`${base}/sources/${doc._id}`).then((r) => r.json());
    console.log('Chunks Count:  ', sourceRes.chunkCount);

    let prevText: string | null = null;
    let seqOk = true;
    let metaInherited = true;
    let nonIdentical = true;

    sourceRes.chunks.forEach((chunk: any, i: number) => {
      if (chunk.chunkIndex !== i) seqOk = false;
      if (prevText && prevText === chunk.text) nonIdentical = false;
      if (!chunk.metadata?.sourceUrl || !chunk.metadata?.topics) metaInherited = false;
      prevText = chunk.text;

      const words = chunk.text.split(/\s+/).length;
      const snippet = chunk.text.replace(/\n/g, ' ').substring(0, 95);
      console.log(`  [Chunk #${chunk.chunkIndex}] (${words} words): "${snippet}..."`);
    });

    console.log('Sequential Indices:   ', seqOk ? 'PASS' : 'FAIL');
    console.log('Non-identical Chunks: ', nonIdentical ? 'PASS' : 'FAIL');
    console.log('Metadata Inherited:   ', metaInherited ? 'PASS' : 'FAIL');
  }
}

inspect().catch(console.error);
