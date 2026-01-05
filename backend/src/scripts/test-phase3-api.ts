
const API_URL = 'http://localhost:4000/api';

async function runTest() {
    console.log('🚀 Starting Phase 3 API Verification (using fetch)...');

    try {
        // 1. Fetch Regions
        console.log('\n--- 1. Fetching Regions ---');
        const regionsRes = await fetch(`${API_URL}/regions`);
        const regions = await regionsRes.json();
        console.log(`Found ${regions.length} regions:`, regions.map((r: any) => r.name).join(', '));

        const amr = regions.find((r: any) => r.name === 'AMR');
        const sgp = regions.find((r: any) => r.name === 'SGP');

        if (!amr || !sgp) {
            console.error('❌ Critical: Missing expected AMR or SGP regions. Run seed script properly.');
            return;
        }

        // 2. Test Region Filtering (Analysts)
        console.log('\n--- 2. Testing Analyst Isolation ---');

        const amrAnalystsRes = await fetch(`${API_URL}/analysts`, {
            headers: { 'x-region-id': amr.id }
        });
        const amrAnalysts = await amrAnalystsRes.json();
        console.log(`AMR Analysts: ${amrAnalysts.length}`);
        const amrSample = amrAnalysts[0];
        if (amrSample && amrSample.regionId !== amr.id) console.error(`❌ AMR Analyst region mismatch! ${amrSample.regionId} != ${amr.id}`);

        const sgpAnalystsRes = await fetch(`${API_URL}/analysts`, {
            headers: { 'x-region-id': sgp.id }
        });
        const sgpAnalysts = await sgpAnalystsRes.json();
        console.log(`SGP Analysts: ${sgpAnalysts.length}`);
        const sgpSample = sgpAnalysts[0];
        if (sgpSample && sgpSample.regionId !== sgp.id) console.error(`❌ SGP Analyst region mismatch! ${sgpSample.regionId} != ${sgp.id}`);

        if (amrAnalysts.length > 0 && sgpAnalysts.length > 0) {
            // Ensure no overlap
            const amrIds = new Set(amrAnalysts.map((a: any) => a.id));
            const overlap = sgpAnalysts.some((a: any) => amrIds.has(a.id));
            if (overlap) console.error('❌ Data Leak: SGP analyst found in AMR list (or vice versa)');
            else console.log('✅ Analyst isolation verified.');
        } else if (sgpAnalysts.length === 0) {
            console.warn('⚠️ SGP has no analysts. Attempting to seed...');
            // Seed 2 SGP Analysts
            try {
                await fetch(`${API_URL}/analysts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-region-id': sgp.id },
                    body: JSON.stringify({
                        name: 'SGP Analyst 1',
                        email: 'sgp1@example.com',
                        shiftType: 'AM',
                        employeeType: 'EMPLOYEE',
                        skills: ['General']
                    })
                });
                await fetch(`${API_URL}/analysts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-region-id': sgp.id },
                    body: JSON.stringify({
                        name: 'SGP Analyst 2',
                        email: 'sgp2@example.com',
                        shiftType: 'PM',
                        employeeType: 'EMPLOYEE',
                        skills: ['General']
                    })
                });
                console.log('✅ SGP Analysts seeded.');
            } catch (e: any) {
                console.error('❌ Failed to seed SGP analysts:', e.message);
            }
        }

        // 3. Test Schedule Generation Context (Requires Region ID)
        console.log('\n--- 3. Testing Schedule Generation Context ---');
        // Simple date range
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const endDate = new Date(now.getFullYear(), now.getMonth(), 7).toISOString().split('T')[0];

        try {
            const genRes = await fetch(`${API_URL}/schedules/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-region-id': sgp.id
                },
                body: JSON.stringify({ startDate, endDate })
            });

            if (genRes.ok) {
                console.log('✅ SGP Schedule Generation triggered successfully');
            } else {
                const err = await genRes.json();
                console.error('❌ SGP Schedule Generation failed:', err.error || err);
            }
        } catch (error: any) {
            console.error('❌ SGP Schedule Generation network error:', error.message);
        }

        try {
            // Try generating without region ID - should fail
            const failRes = await fetch(`${API_URL}/schedules/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ startDate, endDate })
            });

            if (!failRes.ok) {
                console.log('✅ Request without region header blocked as expected:', failRes.status);
            } else {
                console.error('❌ Critical: Generated schedule WITHOUT region header (Security Risk)');
            }
        } catch (error: any) {
            // Network error might happen if 400 response is handled strangely, but usually fetch doesn't throw on 400
            console.log('Refused connection or other error:', error.message);
        }

        console.log('\n✅ Verification Complete.');

    } catch (error: any) {
        console.error('❌ Test failed:', error.message);
    }
}

runTest();
