#!/usr/bin/env node

/**
 * Test the Crime Story Generator
 * 
 * Usage: node test-crime-story.js
 */

import readline from 'readline';
import axios from 'axios';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n🔍 CRIME STORY GENERATOR TEST\n');
console.log('═'.repeat(50));

// Test repos (pick one)
const testRepos = [
  'https://github.com/octocat/Hello-World',  // Tiny repo
  'https://github.com/vercel/next.js',       // Large framework
  'https://github.com/facebook/react',       // Very popular
];

console.log('\nSuggested test repositories:');
testRepos.forEach((repo, i) => {
  console.log(`${i + 1}. ${repo}`);
});

rl.question('\nEnter repository URL (or press Enter for Hello-World): ', async (repoUrl) => {
  const url = repoUrl.trim() || testRepos[0];
  
  console.log(`\n🎬 Starting investigation of: ${url}\n`);
  
  try {
    // Call the API
    const response = await axios.post('http://localhost:3000/api/analyze', {
      repo_url: url,
      narrative_style: 'true-crime',
    });

    const data = response.data;

    console.log('✅ Analysis started!');
    console.log(`📋 Podcast ID: ${data.id}`);
    console.log(`📊 Status: ${data.status}`);
    
    // Poll for status
    console.log('\n⏳ Monitoring investigation progress...\n');
    
    const podcastId = data.id;
    const checkStatus = async () => {
      try {
        const statusResponse = await axios.get(`http://localhost:3000/api/analyze/${podcastId}/status`);
        const status = statusResponse.data;
        
        console.log(`[${status.progress}%] ${status.message}`);
        
        if (status.status === 'completed') {
          console.log('\n🎉 Investigation complete!');
          
          // Fetch the full podcast
          const podcastResponse = await axios.get(`http://localhost:3000/api/podcasts/${podcastId}`);
          const podcast = podcastResponse.data;
          
          console.log('\n📖 CRIME STORY GENERATED:');
          console.log('═'.repeat(50));
          console.log(`Title: ${podcast.script?.title || 'N/A'}`);
          console.log(`Dramatic Arc: ${podcast.script?.dramatic_arc || 'N/A'}`);
          console.log(`Segments: ${podcast.script?.segments?.length || 0}`);
          console.log(`\nFirst segment preview:`);
          console.log(podcast.script?.segments?.[0]?.text?.substring(0, 200) || 'N/A');
          console.log('...\n');
          
          rl.close();
          return;
        }
        
        if (status.status === 'failed') {
          console.error('\n❌ Investigation failed:', status.message);
          rl.close();
          return;
        }
        
        // Check again in 2 seconds
        setTimeout(checkStatus, 2000);
      } catch (err) {
        console.error('❌ Status check error:', err.message);
        rl.close();
      }
    };
    
    checkStatus();
    
  } catch (error) {
    console.error('❌ Fatal error:', error.response?.data?.error || error.message);
    rl.close();
  }
});
